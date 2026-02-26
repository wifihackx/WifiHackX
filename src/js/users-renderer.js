/**
 * Users Renderer
 * Extracted from users-manager.js to isolate filtering/rendering logic.
 */
'use strict';

function createUsersRenderer() {
  class UsersRenderer {
    constructor(manager) {
      this.manager = manager;
    }

    applyFilter(filter) {
      this.manager.currentFilter = filter;

      document.querySelectorAll('[data-filter]').forEach(btn => {
        if (btn.dataset.filter === filter) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      });

      this.filterAndRender();
    }

    filterAndRender() {
      this.manager.log.trace(
        `Filtrando usuarios: ${this.manager.users.length} total, filtro: ${this.manager.currentFilter}`,
        this.manager.CAT.USERS
      );

      let filtered = this.manager.users;

      switch (this.manager.currentFilter) {
        case 'active':
          filtered = this.manager.users.filter(u => !u.banned);
          break;
        case 'inactive':
          filtered = this.manager.users.filter(u => u.banned === true);
          break;
        case 'admin':
          filtered = this.manager.users.filter(u => u.role === 'admin');
          break;
        case 'banned':
          filtered = this.manager.users.filter(u => u.banned === true);
          break;
        default:
          filtered = this.manager.users;
      }

      this.manager.log.debug(
        `Usuarios filtrados: ${filtered.length} de ${this.manager.users.length}`,
        this.manager.CAT.USERS
      );

      if (this.manager.searchQuery) {
        filtered = filtered.filter(
          u =>
            u.email.toLowerCase().includes(this.manager.searchQuery) ||
            u.name.toLowerCase().includes(this.manager.searchQuery) ||
            u.role.toLowerCase().includes(this.manager.searchQuery)
        );
      }

      this.manager.filteredUsers = filtered;
      this.renderUsers();
    }

    renderUsers() {
      this.manager.log.trace(
        `Renderizando tabla para ${this.manager.filteredUsers.length} usuarios`,
        this.manager.CAT.USERS
      );

      const tbody = document.getElementById('usersTableBody');
      if (!tbody) {
        this.manager.log.error('#usersTableBody no encontrado en el DOM', this.manager.CAT.INIT);
        return;
      }

      tbody.innerHTML = '';

      if (this.manager.filteredUsers.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" class="table-empty">No hay usuarios que mostrar</td></tr>';
        return;
      }

      this.manager.filteredUsers.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'user-row';
        row.dataset.userId = user.id;

        const statusText = user.banned ? 'Baneado' : 'Activo';
        const statusClass = user.banned ? 'banned' : 'active';

        const isAdmin = user.role === 'admin';
        const isProtected =
          typeof this.manager._isProtectedAdmin === 'function'
            ? this.manager._isProtectedAdmin(user)
            : false;

        if (isAdmin || isProtected) {
          this.manager.log.debug(
            `🛡️ Verificando protección para: ${user.email} (isAdmin=${isAdmin}, isProtected=${isProtected})`,
            this.manager.CAT.USERS
          );
        }

        const currentUser =
          window.firebase && window.firebase.auth ? window.firebase.auth().currentUser : null;
        const isEditingSelf = currentUser && currentUser.uid === user.id;

        const editButton =
          (isAdmin || isProtected) && !isEditingSelf
            ? `
            <button 
              class="btn-icon btn-edit" 
              disabled
              title="No se puede editar a otro administrador"
              aria-label="No se puede editar a otro administrador"
              class="btn-icon btn-edit btn-disabled">
              Protegido
            </button>
          `
            : `
            <button 
              class="btn-icon btn-edit" 
              data-action="edit-user"
              data-user-id="${user.id}"
              title="${isEditingSelf ? 'Editar mi perfil' : 'Editar usuario'}"
              aria-label="${isEditingSelf ? 'Editar mi perfil' : `Editar usuario ${user.email}`}">
              ${isEditingSelf ? 'Mi Perfil' : 'Editar'}
            </button>
          `;

        const banButton = user.banned
          ? `
            <button 
              class="btn-icon btn-unban" 
              data-action="unban-user"
              data-user-id="${user.id}"
              title="Desbanear usuario"
              aria-label="Desbanear usuario ${user.email}">
              Desbanear
            </button>
          `
          : isAdmin || isProtected
            ? `
            <button 
              class="btn-icon btn-ban" 
              disabled
              title="No se puede banear a un administrador"
              aria-label="No se puede banear a un administrador"
              class="btn-icon btn-ban btn-disabled">
              Protegido
            </button>
          `
            : `
            <button 
              class="btn-icon btn-ban" 
              data-action="ban-user"
              data-user-id="${user.id}"
              data-user-email="${user.email}"
              title="Banear usuario"
              aria-label="Banear usuario ${user.email}">
              Banear
            </button>
          `;

        const deleteButton =
          isAdmin || isProtected
            ? `
            <button 
              class="btn-icon btn-delete" 
              disabled
              title="No se puede eliminar a un administrador protegido"
              aria-label="No se puede eliminar a un administrador protegido"
              class="btn-icon btn-delete btn-disabled">
              Protegido
            </button>
          `
            : `
            <button 
              class="btn-icon btn-delete" 
              data-action="delete-user"
              data-user-id="${user.id}"
              title="Eliminar usuario"
              aria-label="Eliminar usuario ${user.email}">
              Eliminar
            </button>
          `;

        row.innerHTML = `
          <td>${this.manager.escapeHtml(user.name)}</td>
          <td>${this.manager.escapeHtml(user.email)}</td>
          <td>${user.joinDate}</td>
          <td><span class="status status-${statusClass}">${statusText}</span></td>
          <td><span class="role-badge role-${user.role}">${user.role.toUpperCase()}</span></td>
          <td>
            <div class="actions-cell">
              ${editButton}
              ${banButton}
              ${deleteButton}
            </div>
          </td>
        `;

        tbody.appendChild(row);
      });

      this.manager.log.debug('Tabla de usuarios actualizada en el DOM', this.manager.CAT.USERS);
    }
  }

  window.UsersRenderer = UsersRenderer;
}

export function initUsersRenderer() {
  if (window.__USERS_RENDERER_INITED__) {
    return;
  }

  window.__USERS_RENDERER_INITED__ = true;

  if (!window.UsersRenderer) {
    createUsersRenderer();
  }
}

if (typeof window !== 'undefined' && !window.__USERS_RENDERER_NO_AUTO__) {
  initUsersRenderer();
}
