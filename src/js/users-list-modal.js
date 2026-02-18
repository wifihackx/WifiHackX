/**
 * Users List Modal - Modal moderno para mostrar listado completo de usuarios
 * @version 1.0.0
 */

'use strict';

function createUsersListModal() {
  if (window.UsersListModal && window.UsersListModal.__initialized) {
    return;
  }

  async function ensureAdminSettingsCache() {
    if (window.AdminSettingsCache) return window.AdminSettingsCache;
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
    const isAdminRole =
      user.isAdmin === true ||
      String(user.role || '').toLowerCase() === 'admin' ||
      String(user.role || '').toLowerCase() === 'super_admin';
    if (isAdminRole) return true;
    const currentUser =
      window.firebase?.auth && typeof window.firebase.auth === 'function'
        ? window.firebase.auth().currentUser
        : null;
    if (currentUser && user.uid && user.uid === currentUser.uid) return true;
    return (
      (user.email &&
        allowlist.emails.includes(user.email.toLowerCase())) ||
      allowlist.uids.includes(user.uid)
    );
  }

  // Fallback del logger
  const logSystem = window.Logger || {
    info: () => {},
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: () => {},
  };
  const CAT = window.LOG_CATEGORIES || {
    UI: 'UI',
    DATA: 'DATA',
    ERR: 'ERR',
  };

  let allUsers = [];
  let filteredUsers = [];
  let currentFilter = 'all';

  /**
   * Crea el HTML del modal
   */
  function createModalHTML() {
    return `
      <div class="users-modal-overlay hidden" id="usersModalOverlay" aria-hidden="true">
        <div class="users-modal">
          <div class="users-modal-header">
            <h2 class="users-modal-title">
              <i data-lucide="users"></i>
              Listado Completo de Usuarios
            </h2>
            <button class="users-modal-close" id="closeUsersModal" aria-label="Cerrar modal">
              <i data-lucide="x"></i>
            </button>
          </div>

          <div class="users-modal-toolbar">
            <div class="users-search-box">
              <i data-lucide="search"></i>
              <input 
                type="text" 
                id="usersSearchInput" 
                placeholder="Buscar por nombre, email, país..."
                autocomplete="off"
              >
            </div>

            <div class="users-filter-group">
              <button class="users-filter-btn active" data-filter="all">
                <i data-lucide="users"></i>
                Todos
              </button>
              <button class="users-filter-btn" data-filter="premium">
                <i data-lucide="star"></i>
                Compradores
              </button>
              <button class="users-filter-btn" data-filter="admin">
                <i data-lucide="shield"></i>
                Admin
              </button>
            </div>

            <button class="users-export-btn" id="exportUsersBtn">
              <i data-lucide="download"></i>
              Exportar CSV
            </button>
          </div>

          <div class="users-modal-body" id="usersModalBody">
            <div class="users-loading">
              <div class="users-loading-spinner"></div>
              <div class="users-loading-text">Cargando usuarios...</div>
            </div>
          </div>

          <div class="users-modal-footer">
            <div class="users-count-info">
              Mostrando <strong id="usersDisplayCount">0</strong> de <strong id="usersTotalCount">0</strong> usuarios
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Obtiene las iniciales del nombre
   */
  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Formatea la fecha
   */
  function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Genera el HTML de una tarjeta de usuario
   */
  function generateUserCard(user) {
    const initials = getInitials(user.displayName || user.email);
    const isAdmin = user.isAdmin || false;
    const isProtected = isProtectedAdmin(user);
    const hasPurchases = user.purchaseCount > 0;
    const lastLogin = formatDate(user.lastLogin);
    const createdAt = formatDate(user.createdAt);
    const totalRevenue = user.totalRevenue || 0;

    // Botón de eliminar - solo si NO es admin protegido
    const deleteButton = isProtected
      ? `
        <button class="user-delete-btn-compact protected" disabled title="Usuario protegido - No se puede eliminar">
          <i data-lucide="shield"></i>
          <span>🛡️ Protegido</span>
        </button>
      `
      : `
        <button class="user-delete-btn-compact" data-user-id="${user.uid}" data-user-email="${user.email}" title="Eliminar usuario">
          <i data-lucide="trash-2"></i>
          <span>Eliminar</span>
        </button>
      `;

    return `
      <div class="user-card" data-user-id="${user.uid}">
        <div class="user-card-header">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <h3 class="user-name">${user.displayName || 'Sin nombre'}</h3>
            <div class="user-email">${user.email}</div>
          </div>
          ${isAdmin ? '<span class="user-badge admin">Admin</span>' : ''}
          ${hasPurchases ? '<span class="user-badge premium">Premium</span>' : ''}
          ${isProtected ? '<span class="user-badge protected">🛡️ Protegido</span>' : ''}
        </div>

        <div class="user-card-body">
          <div class="user-stat">
            <div class="user-stat-label">Inicios de sesión</div>
            <div class="user-stat-value">
              <i data-lucide="log-in"></i>
              ${user.loginCount || 0}
            </div>
          </div>

          <div class="user-stat">
            <div class="user-stat-label">Compras</div>
            <div class="user-stat-value ${hasPurchases ? 'success' : ''}">
              <i data-lucide="shopping-cart"></i>
              ${user.purchaseCount || 0}
            </div>
          </div>

          <div class="user-stat">
            <div class="user-stat-label">Ingresos</div>
            <div class="user-stat-value ${hasPurchases ? 'success' : ''}">
              <i data-lucide="euro"></i>
              €${totalRevenue.toFixed(2)}
            </div>
          </div>

          <div class="user-stat">
            <div class="user-stat-label">País</div>
            <div class="user-stat-value">
              <i data-lucide="map-pin"></i>
              ${user.country || 'N/A'}
            </div>
          </div>

          <div class="user-stat">
            <div class="user-stat-label">IP</div>
            <div class="user-stat-value">
              <i data-lucide="wifi"></i>
              ${user.lastIP || 'N/A'}
            </div>
          </div>

          <div class="user-stat user-stat-delete">
            ${deleteButton}
          </div>
        </div>

        <div class="user-card-footer">
          <div class="user-meta-item">
            <i data-lucide="calendar"></i>
            Registro: ${createdAt}
          </div>
          <div class="user-meta-item">
            <i data-lucide="clock"></i>
            Último acceso: ${lastLogin}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza la lista de usuarios
   */
  function renderUsers(users) {
    const body = document.getElementById('usersModalBody');
    if (!body) return;
    const displayCountEl = document.getElementById('usersDisplayCount');
    if (displayCountEl) {
      displayCountEl.textContent = users.length;
    }

    if (users.length === 0) {
      body.innerHTML = `
        <div class="users-empty">
          <i data-lucide="users" class="users-empty-icon"></i>
          <div class="users-empty-text">No se encontraron usuarios</div>
          <div class="users-empty-subtext">Intenta ajustar los filtros de búsqueda</div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'users-grid';
    grid.innerHTML = users.map(user => generateUserCard(user)).join('');

    body.innerHTML = '';
    body.appendChild(grid);

    // Re-inicializar iconos de Lucide
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Actualizar contador
    document.getElementById('usersDisplayCount').textContent = users.length;
  }

  /**
   * Filtra usuarios por búsqueda
   */
  function filterUsers(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      filteredUsers = allUsers;
    } else {
      filteredUsers = allUsers.filter(user => {
        const name = (user.displayName || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const country = (user.country || '').toLowerCase();
        const ip = (user.lastIP || '').toLowerCase();

        return (
          name.includes(term) ||
          email.includes(term) ||
          country.includes(term) ||
          ip.includes(term)
        );
      });
    }

    applyFilter(currentFilter);
  }

  /**
   * Aplica filtro por tipo de usuario
   */
  function applyFilter(filter) {
    currentFilter = filter;
    let usersToShow = filteredUsers;

    if (filter === 'premium') {
      usersToShow = filteredUsers.filter(user => user.purchaseCount > 0);
    } else if (filter === 'admin') {
      usersToShow = filteredUsers.filter(user => {
        const role = String(user.role || '').toLowerCase();
        return user.isAdmin === true || role === 'admin' || role === 'super_admin';
      });
    }

    renderUsers(usersToShow);
  }

  /**
   * Elimina un usuario (Auth + Firestore)
   */
  async function deleteUser(userId, userEmail) {
    // Buscar el usuario en la lista
    const user = allUsers.find(u => u.uid === userId);

    // PROTECCIÓN: Verificar si es administrador protegido
    if (user && isProtectedAdmin(user)) {
      logSystem.error(
        `BLOQUEADO: Intento de eliminar administrador protegido: ${userEmail}`,
        CAT.SECURITY
      );
      const allowlist = getAdminAllowlist();
      const protectedEmails = allowlist.emails || [];
      const protectedUids = allowlist.uids || [];
      let protectedList = '';
      if (protectedEmails.length) {
        protectedList += protectedEmails.map(email => `- ${email}`).join('\n');
      }
      if (protectedUids.length) {
        protectedList +=
          (protectedList ? '\n' : '') +
          protectedUids.map(uid => `- UID: ${uid}`).join('\n');
      }
      if (!protectedList) {
        protectedList = '- (Configura admins protegidos en Seguridad)';
      }
      alert(
        '🛡️ ERROR DE SEGURIDAD\n\n' +
          'No se puede eliminar a un administrador protegido.\n\n' +
          'Usuarios protegidos:\n' +
          protectedList +
          '\n\n' +
          'Si necesitas remover privilegios de administrador, contacta al super administrador.'
      );
      return;
    }

    // Confirmación doble para seguridad
    const confirmMessage = `⚠️ ¿Estás seguro de que deseas ELIMINAR al usuario?\n\nEmail: ${userEmail}\nUID: ${userId}\n\n⚠️ ESTA ACCIÓN ES IRREVERSIBLE Y ELIMINARÁ:\n- La cuenta de Firebase Authentication\n- El documento en Firestore\n- Todos los datos asociados`;

    if (!confirm(confirmMessage)) {
      return;
    }

    // Segunda confirmación
    if (
      !confirm(
        '⚠️ ÚLTIMA CONFIRMACIÓN: ¿Realmente deseas eliminar este usuario?'
      )
    ) {
      return;
    }

    try {
      logSystem.info(`Deleting user: ${userEmail} (${userId})`, CAT.DATA);

      // Mostrar indicador de carga
      if (window.NotificationSystem) {
        window.NotificationSystem.info('Eliminando usuario...');
      }

      // Llamar a Cloud Function para eliminar usuario
      const deleteUserFunction = firebase
        .functions()
        .httpsCallable('deleteUser');
      const result = await deleteUserFunction({ userId });

      if (result.data.success) {
        logSystem.info(`User deleted successfully: ${userEmail}`, CAT.DATA);

        // Eliminar de la lista local
        allUsers = allUsers.filter(u => u.uid !== userId);
        filteredUsers = filteredUsers.filter(u => u.uid !== userId);

        // Re-renderizar
        applyFilter(currentFilter);

        // Actualizar contador total
        document.getElementById('usersTotalCount').textContent =
          allUsers.length;

        if (window.NotificationSystem) {
          window.NotificationSystem.success(
            `Usuario ${userEmail} eliminado correctamente`
          );
        }
      } else {
        throw new Error(result.data.error || 'Error desconocido');
      }
    } catch (error) {
      logSystem.error('Error deleting user', CAT.ERR, error);
      const normalizedMessage =
        String(error?.message || '').toUpperCase() === 'INTERNAL'
          ? 'No se pudo eliminar: el usuario no existe en Auth o está protegido.'
          : error.message;

      if (window.NotificationSystem) {
        window.NotificationSystem.error(
          `Error al eliminar usuario: ${normalizedMessage}`
        );
      } else {
        alert(`❌ Error al eliminar usuario: ${normalizedMessage}`);
      }
    }
  }

  /**
   * Exporta usuarios a CSV
   */
  function exportToCSV() {
    const headers = [
      'Nombre',
      'Email',
      'País',
      'IP',
      'Inicios de sesión',
      'Compras',
      'Ingresos (€)',
      'Admin',
      'Fecha de registro',
      'Último acceso',
    ];

    const rows = filteredUsers.map(user => [
      user.displayName || 'Sin nombre',
      user.email,
      user.country || 'N/A',
      user.lastIP || 'N/A',
      user.loginCount || 0,
      user.purchaseCount || 0,
      (user.totalRevenue || 0).toFixed(2),
      user.isAdmin ? 'Sí' : 'No',
      formatDate(user.createdAt),
      formatDate(user.lastLogin),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `usuarios_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.classList.add('invisible');

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logSystem.info(`Exported ${filteredUsers.length} users to CSV`, CAT.DATA);
  }

  /**
   * Carga usuarios desde Firestore
   */
  async function loadUsers() {
    try {
      const db = firebase.firestore();

      // Obtener usuarios de Firebase Auth a través de Cloud Function
      let authUsers = [];
      try {
        const listUsersFunction = firebase
          .functions()
          .httpsCallable('listAdminUsers');
        const authUsersResult = await listUsersFunction();
        authUsers = authUsersResult?.data?.users || [];
      } catch (callableError) {
        logSystem.warn(
          'listAdminUsers no disponible; usando fallback de Firestore',
          CAT.DATA,
          callableError
        );
      }

      // Obtener datos adicionales de Firestore
      const usersSnapshot = await db.collection('users').get();
      const firestoreUsers = {};

      usersSnapshot.forEach(doc => {
        firestoreUsers[doc.id] = doc.data();
      });

      // Obtener órdenes (si falla por permisos, seguimos sin bloquear el modal)
      const userOrders = {};
      try {
        const ordersSnapshot = await db.collection('orders').get();
        ordersSnapshot.forEach(doc => {
          const order = doc.data();
          const userId = order.userId;
          if (!userId) return;

          if (!userOrders[userId]) {
            userOrders[userId] = {
              count: 0,
              revenue: 0,
            };
          }

          userOrders[userId].count++;
          userOrders[userId].revenue += parseFloat(order.price) || 0;
        });
      } catch (ordersError) {
        logSystem.warn(
          'No se pudieron cargar órdenes; mostrando usuarios sin métricas de compras',
          CAT.DATA,
          ordersError
        );
      }

      const sourceUsers =
        authUsers.length > 0
          ? authUsers
          : Object.entries(firestoreUsers).map(([uid, row]) => ({
              uid,
              email: row?.email || '',
              displayName: row?.displayName || row?.name || '',
              customClaims: row?.customClaims || {},
              metadata: {
                creationTime: row?.createdAt?.toDate?.()?.toISOString?.() || null,
                lastSignInTime: row?.lastLogin?.toDate?.()?.toISOString?.() || null,
              },
            }));

      // Combinar datos
      allUsers = sourceUsers.map(authUser => {
        const firestoreData = firestoreUsers[authUser.uid] || {};
        const orders = userOrders[authUser.uid] || { count: 0, revenue: 0 };
        const claimRole = String(authUser.customClaims?.role || '').toLowerCase();
        const firestoreRole = String(firestoreData.role || '').toLowerCase();
        const currentAuthUser =
          window.firebase?.auth && typeof window.firebase.auth === 'function'
            ? window.firebase.auth().currentUser
            : null;
        const currentEmail = String(currentAuthUser?.email || '').toLowerCase();
        const appUserState = window.AppState?.getState
          ? window.AppState.getState('user')
          : null;
        const appIsAdmin =
          appUserState?.isAdmin === true ||
          localStorage.getItem('isAdmin') === 'true';
        const isAdmin =
          authUser.customClaims?.admin ||
          claimRole === 'admin' ||
          claimRole === 'super_admin' ||
          firestoreRole === 'admin' ||
          firestoreRole === 'super_admin' ||
          (appIsAdmin &&
            currentEmail &&
            String(authUser.email || firestoreData.email || '')
              .toLowerCase()
              .includes(currentEmail));
        const role = isAdmin ? 'admin' : firestoreRole || 'user';
        const email = authUser.email || firestoreData.email || 'Sin email';
        const fallbackName =
          email && email.includes('@') ? email.split('@')[0] : '';

        const userObject = {
          uid: authUser.uid,
          email,
          displayName:
            authUser.displayName ||
            firestoreData.displayName ||
            firestoreData.name ||
            fallbackName ||
            '',
          isAdmin: !!isAdmin,
          role,
          createdAt: authUser.metadata?.creationTime
            ? new Date(authUser.metadata.creationTime)
            : firestoreData.createdAt || null,
          lastLogin: authUser.metadata?.lastSignInTime
            ? new Date(authUser.metadata.lastSignInTime)
            : firestoreData.lastLogin || null,
          loginCount: firestoreData.loginCount || 0,
          purchaseCount: orders.count,
          totalRevenue: orders.revenue,
          country: firestoreData.country || '',
          lastIP: firestoreData.lastIP || '',
        };

        return userObject;
      });

      // Ordenar alfabéticamente por nombre
      allUsers.sort((a, b) => {
        const nameA = (a.displayName || a.email).toLowerCase();
        const nameB = (b.displayName || b.email).toLowerCase();
        return nameA.localeCompare(nameB);
      });
      // Quitar filas no útiles sin email real (normalmente restos de sincronización incompleta)
      allUsers = allUsers.filter(
        user => typeof user.email === 'string' && user.email.includes('@')
      );

      // Deduplicar por email para evitar tarjetas duplicadas del mismo admin/usuario
      const byEmail = new Map();
      allUsers.forEach(user => {
        const emailKey = String(user.email || '').trim().toLowerCase();
        const key = emailKey || `uid:${user.uid}`;
        const prev = byEmail.get(key);
        if (!prev) {
          byEmail.set(key, user);
          return;
        }
        const prevScore =
          (prev.isAdmin ? 10 : 0) + (Number(prev.loginCount || 0) > 0 ? 1 : 0);
        const nextScore =
          (user.isAdmin ? 10 : 0) + (Number(user.loginCount || 0) > 0 ? 1 : 0);
        if (nextScore > prevScore) {
          byEmail.set(key, user);
        }
      });
      allUsers = Array.from(byEmail.values());

      filteredUsers = allUsers;

      // Actualizar contador total
      document.getElementById('usersTotalCount').textContent = allUsers.length;

      // Renderizar usuarios
      renderUsers(allUsers);

      logSystem.info(`Loaded ${allUsers.length} users`, CAT.DATA);
    } catch (error) {
      logSystem.error('Error loading users', CAT.ERR, error);

      const body = document.getElementById('usersModalBody');
      if (body) {
        body.innerHTML = `
          <div class="users-empty">
            <i data-lucide="alert-circle" class="users-empty-icon"></i>
            <div class="users-empty-text">Error al cargar usuarios</div>
            <div class="users-empty-subtext">${error.message}</div>
          </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }
  }

  /**
   * Muestra el modal
   */
  async function showModal() {
    // Crear modal si no existe
    let overlay = document.getElementById('usersModalOverlay');

    if (!overlay) {
      const modalHTML = createModalHTML();
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      overlay = document.getElementById('usersModalOverlay');

      // Inicializar iconos
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      // Event listeners
      document
        .getElementById('closeUsersModal')
        .addEventListener('click', hideModal);
      overlay.addEventListener('click', e => {
        if (e.target === overlay) hideModal();
      });

      // Búsqueda
      document
        .getElementById('usersSearchInput')
        .addEventListener(
          'input',
          e => {
            filterUsers(e.target.value);
          },
          { passive: true }
        );

      // Filtros
      document.querySelectorAll('.users-filter-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          document
            .querySelectorAll('.users-filter-btn')
            .forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
          applyFilter(e.currentTarget.dataset.filter);
        });
      });

      // Exportar
      document
        .getElementById('exportUsersBtn')
        .addEventListener('click', exportToCSV);

      // Delegación de eventos para botones de eliminar
      document.addEventListener('click', e => {
        const deleteBtn = e.target.closest('.user-delete-btn-compact');
        if (deleteBtn) {
          e.preventDefault();
          e.stopPropagation();
          const userId = deleteBtn.dataset.userId;
          const userEmail = deleteBtn.dataset.userEmail;
          deleteUser(userId, userEmail);
        }
      });

      // Tecla ESC para cerrar
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
          hideModal();
        }
      });
    }

    // Mostrar modal
    overlay.classList.add('active');
    window.DOMUtils.setDisplay(overlay, 'flex');
    overlay.setAttribute('aria-hidden', 'false');
    window.DOMUtils.lockBodyScroll(true);

    // Cargar settings para allowlist (si aplica) y luego usuarios
    await ensureAdminSettingsCache();
    loadUsers();

    logSystem.info('Users modal opened', CAT.UI);
  }

  /**
   * Oculta el modal
   */
  function hideModal() {
    const overlay = document.getElementById('usersModalOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      window.DOMUtils.setDisplay(overlay, 'none');
      overlay.setAttribute('aria-hidden', 'true');
      window.DOMUtils.lockBodyScroll(false);
      logSystem.info('Users modal closed', CAT.UI);
    }
  }

  /**
   * Inicializar
   */
  function init() {
    if (window.UsersListModal && window.UsersListModal.__initialized) {
      return;
    }
    // Escuchar evento de clic en la tarjeta de usuarios
    document.addEventListener('click', e => {
      const card = e.target.closest('[data-action="showFullUsersList"]');
      if (card) {
        e.preventDefault();
        showModal();
      }
    });

    logSystem.debug('Users List Modal initialized', CAT.UI);
    if (!window.UsersListModal) {
      window.UsersListModal = {};
    }
    window.UsersListModal.__initialized = true;
  }

  // Exponer funciones globalmente sin sobrescribir estados existentes
  window.UsersListModal = window.UsersListModal || {};
  window.UsersListModal.show = showModal;
  window.UsersListModal.hide = hideModal;

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

export function initUsersListModal() {
  if (window.__USERS_LIST_MODAL_INITED__) {
    return;
  }

  window.__USERS_LIST_MODAL_INITED__ = true;
  createUsersListModal();
}

if (typeof window !== 'undefined' && !window.__USERS_LIST_MODAL_NO_AUTO__) {
  initUsersListModal();
}
