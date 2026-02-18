/**
 * ============================================
 * USERS MANAGER - GESTIÓN COMPLETA DE USUARIOS
 * ============================================
 *
 * Archivo: js/users-manager.js
 * Propósito: Manejar todas las acciones de usuarios en admin panel
 * Usa EventDelegationManager para event handling robusto
 *
 * @version 2.0.0 - Migrado a EventDelegationManager
 */

(function () {
  'use strict';

  if (window.UsersManager) {
    return;
  }

  async function ensureAdminSettingsCache() {
    if (window.AdminSettingsCache) return window.AdminSettingsCache;
    const auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
    if (!auth || !auth.currentUser) return null;
    if (window.AdminSettingsService?.getSettings) {
      const settings = await window.AdminSettingsService.getSettings({
        allowDefault: false,
      });
      if (settings) {
        window.AdminSettingsCache = settings;
        return settings;
      }
    }
    return window.AdminSettingsCache || null;
  }

  function getAdminAllowlist() {
    const emails = (window.AdminSettingsCache?.security?.adminAllowlistEmails || '')
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean);
    const uids = (window.AdminSettingsCache?.security?.adminAllowlistUids || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    return { emails, uids };
  }

  /**
   * Verificar si un usuario es administrador protegido
   */
  function isProtectedAdmin(user) {
    if (!user) return false;
    const allowlist = getAdminAllowlist();
    const role = String(user.role || '').toLowerCase();
    if (role === 'admin' || role === 'super_admin') return true;
    const currentUser =
      window.firebase?.auth && typeof window.firebase.auth === 'function'
        ? window.firebase.auth().currentUser
        : null;
    if (currentUser && user.id && user.id === currentUser.uid) return true;
    return (
      (user.email &&
        allowlist.emails.includes(user.email.toLowerCase())) ||
      allowlist.uids.includes(user.id)
    );
  }

  const warnMissing = name => {
    console.warn(`[USERS-MANAGER] ${name} no disponible`);
  };

  const moduleLog = window.Logger || {
    info: (m, c) => console.log(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => console.log(`[DEBUG][${c}] ${m}`),
  };
  const moduleCat = window.LOG_CATEGORIES || {
    INIT: 'INIT',
  };

  class UsersManager {
    constructor() {
      this.users = [];
      this.filteredUsers = [];
      this.currentFilter = 'all';

      this.editingUserId = null;
      this.editingUserName = '';
      this.editingIsSelf = false;
      // Fallback del logger
      this.log = window.Logger || {
        info: (m, c) => console.log(`[${c}] ${m}`),
        warn: (m, c) => console.warn(`[${c}] ${m}`),
        error: (m, c, d) => console.error(`[${c}] ${m}`, d),
        debug: (m, c) => console.log(`[DEBUG][${c}] ${m}`),
        trace: (m, c) => console.log(`[TRACE][${c}] ${m}`),
      };
      this.CAT = window.LOG_CATEGORIES || {
        USERS: 'USERS',
        ADMIN: 'ADMIN',
        INIT: 'INIT',
        ERR: 'ERR',
      };

      // Flag para prevenir llamadas concurrentes a loadUsers
      this._isLoadingUsers = false;
      this._handlersRegistered = false;
      this._handlersRetryTimer = null;
      this._isProtectedAdmin = isProtectedAdmin;
      this._getAdminAllowlist = getAdminAllowlist;
      this.renderer =
        window.UsersRenderer ? new window.UsersRenderer(this) : null;

      this.log.debug('UsersManager Constructor llamado', this.CAT.INIT);
    }

    /**
     * Inicializar el manager
     */
    async init() {
      this.log.debug('Inicializando UsersManager...', this.CAT.INIT);
      await ensureAdminSettingsCache();
      this.ensureEventHandlers();
      this.ensureRenderer();

      // NO cargar usuarios automáticamente - solo cuando el usuario abra el panel
      this.log.info(
        'UsersManager listo (esperando apertura de panel)',
        this.CAT.INIT
      );

      const tryLoadIfActive = () => {
        const usersSection = document.getElementById('usersSection');
        const adminView = document.getElementById('adminView');
        const isActive =
          usersSection &&
          usersSection.classList.contains('active') &&
          adminView &&
          adminView.classList.contains('active');
        if (isActive) {
          this.loadUsers();
        }
      };

      // Load users when auth state is ready and users section is active
      if (window.firebase && window.firebase.auth) {
        window.firebase.auth().onAuthStateChanged(() => {
          tryLoadIfActive();
        });
      } else {
        // Fallback: retry once components & firebase are ready
        setTimeout(() => tryLoadIfActive(), 500);
      }

      // Intento inmediato si la sección ya está activa
      setTimeout(() => tryLoadIfActive(), 0);

      // Re-check after components load (users section might be injected)
      document.addEventListener('components:ready', () => {
        tryLoadIfActive();
        startUsersSectionObserver();
      });

      // Re-check after admin scripts load
      window.addEventListener('adminScriptsLoaded', () => {
        tryLoadIfActive();
        startUsersSectionObserver();
      });

      // Watch users section activation to load users even if tabs change before manager is ready
      let usersSectionObserver = null;
      const observeUsersSection = () => {
        const usersSection = document.getElementById('usersSection');
        if (!usersSection) return;
        if (usersSectionObserver) return;
        const observer = new MutationObserver(() => {
          if (usersSection.classList.contains('active')) {
            tryLoadIfActive();
          }
        });
        observer.observe(usersSection, { attributes: true, attributeFilter: ['class'] });
        usersSectionObserver = observer;
      };

      const startUsersSectionObserver = () => {
        observeUsersSection();

        // Si la sección aún no existe, observar el DOM para cuando se inyecte
        if (!document.getElementById('usersSection')) {
          const domObserver = new MutationObserver(() => {
            if (document.getElementById('usersSection')) {
              observeUsersSection();
              domObserver.disconnect();
            }
          });
          domObserver.observe(document.body, {
            childList: true,
            subtree: true,
          });
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startUsersSectionObserver);
      } else {
        startUsersSectionObserver();
      }
    }

    /**
     * Registrar event handlers usando EventDelegationManager
     */
    registerEventHandlers() {
      this.log.trace('Registrando event handlers...', this.CAT.INIT);

      const manager =
        window.EventDelegationManager || window.eventDelegationManager;

      if (!manager) {
        this.log.warn('EventDelegationManager no disponible (retry)', this.CAT.INIT);
        return false;
      }

      // Botón Exportar Usuarios
      manager.register('exportUsers', (target, event) => {
        if (event) event.preventDefault();
        this.log.info(
          'Solicitud de exportación de usuarios recibida',
          this.CAT.USERS
        );
        this.exportUsers();
      });

      // Botón Crear Usuario
      manager.register('createUser', (target, event) => {
        if (event) event.preventDefault();
        this.log.info(
          'Solicitud de creación de usuario recibida',
          this.CAT.USERS
        );
        this.createUser();
      });

      // Botón Sincronizar Usuarios
      manager.register('syncUsers', (target, event) => {
        if (event) event.preventDefault();
        this.log.info(
          'Solicitud de sincronización de usuarios recibida',
          this.CAT.USERS
        );
        this.syncUsers();
      });

      // Botones de Filtro
      document.addEventListener('click', e => {
        const filterBtn = e.target.closest('[data-filter]');
        if (filterBtn) {
          e.preventDefault();
          const filter = filterBtn.dataset.filter;
          this.log.debug(
            `Aplicando filtro de usuarios: ${filter}`,
            this.CAT.USERS
          );
          this.applyFilter(filter);
        }
      });

      // Búsqueda de usuarios
      const searchInput = document.getElementById('userSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', e => {
          this.searchQuery = e.target.value.toLowerCase();
          this.log.trace(
            `Búsqueda de usuarios: ${this.searchQuery}`,
            this.CAT.USERS
          );
          this.filterAndRender();
        });
      }

      // Botones de acción por usuario (editar)
      manager.register('edit-user', (target, event) => {
        if (event) event.preventDefault();
        const userId = target.dataset.userId;
        this.log.info(`Editando usuario: ${userId}`, this.CAT.USERS);
        this.editUser(userId);
      });

      // NOTA: 'ban-user' y 'unban-user' son manejados por ban-system.js
      // Se han eliminado de aquí para evitar ejecución duplicada.

      manager.register('delete-user', (target, event) => {
        if (event) event.preventDefault();
        const userId = target.dataset.userId;
        this.log.warn(
          `Solicitud de eliminación de usuario: ${userId}`,
          this.CAT.ADMIN
        );
        this.deleteUser(userId);
      });

      this.log.trace('Event handlers registrados correctamente', this.CAT.INIT);
      this._handlersRegistered = true;
      return true;
    }

    ensureRenderer() {
      if (this.renderer) return;
      if (window.UsersRenderer) {
        this.renderer = new window.UsersRenderer(this);
        return;
      }
      if (this._rendererRetryTimer) return;
      let attempts = 0;
      this._rendererRetryTimer = setInterval(() => {
        attempts += 1;
        if (window.UsersRenderer) {
          this.renderer = new window.UsersRenderer(this);
          clearInterval(this._rendererRetryTimer);
          this._rendererRetryTimer = null;
          return;
        }
        if (attempts >= 20) {
          clearInterval(this._rendererRetryTimer);
          this._rendererRetryTimer = null;
          this.log.warn('UsersRenderer no disponible tras reintentos', this.CAT.INIT);
        }
      }, 300);
    }
    ensureEventHandlers() {
      if (this._handlersRegistered) return;
      const ok = this.registerEventHandlers();
      if (ok) return;
      if (this._handlersRetryTimer) return;
      let attempts = 0;
      this._handlersRetryTimer = setInterval(() => {
        attempts += 1;
        if (this.registerEventHandlers()) {
          clearInterval(this._handlersRetryTimer);
          this._handlersRetryTimer = null;
          return;
        }
        if (attempts >= 20) {
          clearInterval(this._handlersRetryTimer);
          this._handlersRetryTimer = null;
          this.log.warn('EventDelegationManager no disponible tras reintentos', this.CAT.INIT);
        }
      }, 300);
    }

    /**
     * Cargar usuarios desde Firebase
     */
    async loadUsers() {
      // Prevenir llamadas concurrentes
      if (this._isLoadingUsers) {
        return;
      }
      const now = Date.now();
      if (this._lastLoadAt && now - this._lastLoadAt < 600) {
        return;
      }
      this._lastLoadAt = now;

      if (window.UsersData && window.UsersData.loadUsers) {
        const result = await window.UsersData.loadUsers(this);
        if (!this.renderer) {
          this.ensureRenderer();
        }
        return result;
      }
      warnMissing('UsersData (loadUsers)');
    }

    /**
     * Aplicar filtro
     */
    applyFilter(filter) {
      if (this.renderer && this.renderer.applyFilter) {
        return this.renderer.applyFilter(filter);
      }
      warnMissing('UsersRenderer (applyFilter)');
    }

    /**
     * Filtrar y renderizar usuarios
     */
    filterAndRender() {
      if (this.renderer && this.renderer.filterAndRender) {
        return this.renderer.filterAndRender();
      }
      warnMissing('UsersRenderer (filterAndRender)');
    }

    /**
     * Renderizar tabla de usuarios
     */
    renderUsers() {
      if (this.renderer && this.renderer.renderUsers) {
        return this.renderer.renderUsers();
      }
      warnMissing('UsersRenderer (renderUsers)');
    }

    /**
     * Exportar usuarios a CSV
     */
    exportUsers() {
      if (window.UsersActions && window.UsersActions.exportUsers) {
        return window.UsersActions.exportUsers(this);
      }
      warnMissing('UsersActions (exportUsers)');
    }

    /**
     * Crear nuevo usuario
     */
    createUser() {
      if (window.UsersActions && window.UsersActions.createUser) {
        return window.UsersActions.createUser(this);
      }
      warnMissing('UsersActions (createUser)');
    }

    /**
     * Sincronizar usuarios desde Firebase Auth a Firestore
     * Crea documentos de usuario faltantes
     */
    async syncUsers() {
      if (window.UsersActions && window.UsersActions.syncUsers) {
        return window.UsersActions.syncUsers(this);
      }
      warnMissing('UsersActions (syncUsers)');
    }

    /**
     * Mostrar modal de creación de usuario
     */
    showCreateUserModal() {
      this.log.debug(
        'Abriendo modal de creación de usuario...',
        this.CAT.USERS
      );
      if (window.UsersModalManager && window.UsersModalManager.openCreate) {
        window.UsersModalManager.openCreate(this);
      } else {
        warnMissing('UsersModalManager (openCreate)');
      }
    }

    /**
     * Crear HTML del modal de creación
     */
    /**
     * Cerrar modal de creación
     */
    closeCreateUserModal() {
      if (window.UsersModalManager && window.UsersModalManager.closeCreate) {
        window.UsersModalManager.closeCreate();
      }
    }

    /**
     * Manejar submit del formulario de creación
     */
    async handleCreateUserSubmit() {
      if (window.UsersForms && window.UsersForms.handleCreate) {
        return window.UsersForms.handleCreate(this);
      }
      warnMissing('UsersForms (handleCreate)');
    }

    /**
     * Editar usuario
     */
    editUser(userId) {
      const user = this.users.find(u => u.id === userId);
      if (!user) {
        alert('Usuario no encontrado');
        return;
      }

      // Obtener el usuario actual
      const currentUser =
        window.firebase && window.firebase.auth
          ? window.firebase.auth().currentUser
          : null;
      const isEditingSelf = currentUser && currentUser.uid === userId;

      // PROTECCIÓN: No permitir editar a OTROS administradores
      if (user.role === 'admin' && !isEditingSelf) {
        this.log.error(
          'BLOQUEADO: Intento de editar a otro administrador',
          this.CAT.ADMIN
        );
        alert(
          'ERROR DE SEGURIDAD\n\nNo se puede editar a otro administrador.\n\nSolo puedes editar tu propio perfil.'
        );
        return;
      }

      // Permitir edición si es usuario normal O si es el mismo admin editándose
      this.log.debug(
        `Abriendo modal de edición para: ${user.email}`,
        this.CAT.USERS
      );
      this.showEditModal(user, isEditingSelf);
    }

    /**
     * Mostrar modal de edición
     */
    showEditModal(user, isEditingSelf) {
      this.log.debug(
        'Abriendo modal de edición de usuario...',
        this.CAT.USERS
      );

      this.editingUserId = user.id;
      this.editingUserName = user.name || user.displayName || '';
      this.editingIsSelf = !!isEditingSelf;

      if (window.UsersModalManager && window.UsersModalManager.openEdit) {
        window.UsersModalManager.openEdit(this, user, isEditingSelf);
      } else {
        warnMissing('UsersModalManager (openEdit)');
      }
    }

    closeEditUserModal() {
      if (window.UsersModalManager && window.UsersModalManager.closeEdit) {
        window.UsersModalManager.closeEdit();
      }
      this.editingUserId = null;
      this.editingUserName = '';
      this.editingIsSelf = false;
    }

    async handleEditUserSubmit() {
      if (window.UsersForms && window.UsersForms.handleEdit) {
        return window.UsersForms.handleEdit(this);
      }
      warnMissing('UsersForms (handleEdit)');
    }

    /**
     * Actualizar nombre de usuario en Firebase
     */
    async updateUserName(userId, newName) {
      if (window.UsersData && window.UsersData.updateUserName) {
        return window.UsersData.updateUserName(this, userId, newName);
      }
      warnMissing('UsersData (updateUserName)');
    }

    /**
     * Banear usuario
     */
    banUser(userId, userEmail) {
      if (window.UsersActions && window.UsersActions.banUser) {
        return window.UsersActions.banUser(this, userId, userEmail);
      }
      warnMissing('UsersActions (banUser)');
    }

    /**
     * Desbanear usuario
     */
    async unbanUser(userId) {
      if (window.UsersActions && window.UsersActions.unbanUser) {
        return window.UsersActions.unbanUser(this, userId);
      }
      warnMissing('UsersActions (unbanUser)');
    }

    /**
     * Eliminar usuario
     */
    async deleteUser(userId) {
      if (window.UsersActions && window.UsersActions.deleteUser) {
        return window.UsersActions.deleteUser(this, userId);
      }
      warnMissing('UsersActions (deleteUser)');
    }

    /**
     * Actualizar estadísticas del dashboard
     * NOTA: Con listener en tiempo real, esto es redundante pero se mantiene por compatibilidad
     */
    updateDashboardStats() {
      const uniqueUsers = new Map();
      this.users.forEach(user => {
        const emailKey = String(user?.email || '')
          .trim()
          .toLowerCase();
        if (!emailKey || !emailKey.includes('@')) return;
        if (!uniqueUsers.has(emailKey)) {
          uniqueUsers.set(emailKey, user);
        }
      });
      const normalizedUsers = Array.from(uniqueUsers.values());
      const totalUsers = normalizedUsers.length;
      const activeUsers = normalizedUsers.filter(u => !u.banned).length;
      const bannedUsers = normalizedUsers.filter(u => u.banned).length;

      this.log.debug(
        `Estadísticas locales: total=${totalUsers}, activos=${activeUsers}, baneados=${bannedUsers}`,
        this.CAT.USERS
      );

      // Actualizar UI si los elementos existen (dashboard o sección de usuarios)
      const usersCountEl = document.getElementById('usersCount');
      if (usersCountEl) {
        usersCountEl.textContent = totalUsers.toLocaleString('es-ES');
      }
      const usersChangeEl = document.getElementById('usersChange');
      if (usersChangeEl) {
        usersChangeEl.textContent =
          totalUsers > 0
            ? `${totalUsers} usuario${totalUsers !== 1 ? 's' : ''} registrado${totalUsers !== 1 ? 's' : ''}`
            : 'Sin usuarios';
        usersChangeEl.className =
          totalUsers > 0 ? 'stat-change positive' : 'stat-change neutral';
      }

      // Sincronizar AppState para mantener consistencia en el dashboard
      if (window.AppState && typeof window.AppState.setState === 'function') {
        const currentStats =
          (window.AppState.getState &&
            window.AppState.getState('admin.stats')) ||
          {};
        window.AppState.setState('admin.stats', {
          ...currentStats,
          users: totalUsers,
        });
      }
    }

    /**
     * Mostrar error
     */
    showError(message) {
      const tbody = document.getElementById('usersTableBody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: red;">${message}</td></tr>`;
      }
    }

    /**
     * Escapar HTML
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  function isFirebaseReady() {
    if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
      return true;
    }
    if (window.firebase && window.firebase.auth) {
      try {
        if (window.firebase.auth()) return true;
      } catch (_e) {}
    }
    if (window.firebaseModular?.app || window.firebaseModular?.db || window.auth) {
      return true;
    }
    return false;
  }

  // Inicializar cuando el DOM y Firebase estén listos
  function init() {
    const initializeManager = async () => {
      moduleLog.debug('Inicializando manager...', moduleCat.INIT);
      window.usersManager = new UsersManager();
      await window.usersManager.init();

      // REMOVED: MutationObserver redundante
      // loadUsers() ahora se llama solo desde admin-section-interceptor.js
      // cuando se abre la sección de usuarios, evitando cargas duplicadas
      moduleLog.info(
        'Manager listo (carga lazy desde interceptor)',
        moduleCat.INIT
      );
      window.dispatchEvent(new CustomEvent('usersManagerReady'));
    };

    // Esperar a que Firebase esté listo
    if (isFirebaseReady()) {
      moduleLog.info(
        'Firebase ya disponible - Inicializando...',
        moduleCat.INIT
      );
      initializeManager();
      return;
    }

    moduleLog.debug('Esperando a Firebase...', moduleCat.INIT);
    const onReady = () => {
      moduleLog.info('Firebase listo - Inicializando...', moduleCat.INIT);
      initializeManager();
    };
    window.addEventListener('firebaseReady', onReady, { once: true });
    window.addEventListener('firebase:initialized', onReady, { once: true });

    const pollStart = Date.now();
    const poll = setInterval(() => {
      if (isFirebaseReady()) {
        clearInterval(poll);
        onReady();
      } else if (Date.now() - pollStart > 8000) {
        clearInterval(poll);
        moduleLog.warn('Firebase no disponible tras 8s, reintentando…', moduleCat.INIT);
        setTimeout(() => {
          if (isFirebaseReady()) {
            onReady();
          }
        }, 2000);
      }
    }, 500);
  }

  // Exponer globalmente
  window.UsersManager = UsersManager;
  window.initUsersManager = init;

  moduleLog.info('✅ Módulo cargado', moduleCat.INIT);
})();

export function initUsersManager() {
  if (window.__USERS_MANAGER_INITED__) {
    return;
  }

  window.__USERS_MANAGER_INITED__ = true;

  if (window.initUsersManager) {
    window.initUsersManager();
  }
}

if (typeof window !== 'undefined' && !window.__USERS_MANAGER_NO_AUTO__) {
  initUsersManager();
}

