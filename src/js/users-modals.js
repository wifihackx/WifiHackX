/**
 * Users Modals Manager
 * Extracted from users-manager.js to reduce file size and isolate UI concerns.
 */
'use strict';

function createUsersModalManager() {
  const safeLucideInit = () => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  };

  const openModal = modal => {
    if (window.ModalManager) {
      window.ModalManager.open(modal);
    } else {
      modal.setAttribute('data-state', 'visible');
      window.DOMUtils.setDisplay(modal, 'flex');
    }
  };

  const closeModal = modal => {
    if (!modal) return;
    if (window.ModalManager) {
      window.ModalManager.close(modal);
    } else {
      modal.setAttribute('data-state', 'hidden');
      window.DOMUtils.setDisplay(modal, 'none');
    }
  };

  const bindCreateModal = (modal, manager) => {
    if (modal.dataset.listenersBound === '1') return;

    const closeButtons = modal.querySelectorAll(
      '[data-action="closeCreateUserModal"]'
    );
    closeButtons.forEach(btn => {
      btn.onclick = () => manager.closeCreateUserModal();
    });

    const escHandler = e => {
      if (e.key === 'Escape') {
        manager.closeCreateUserModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    modal.onclick = e => {
      if (e.target === modal) {
        manager.closeCreateUserModal();
      }
    };

    const form = modal.querySelector('#createUserForm');
    if (form) {
      form.onsubmit = async e => {
        e.preventDefault();
        await manager.handleCreateUserSubmit();
      };
    }

    modal.dataset.listenersBound = '1';
  };

  const bindEditModal = (modal, manager) => {
    if (modal.dataset.listenersBound === '1') return;

    const closeButtons = modal.querySelectorAll(
      '[data-action="closeEditUserModal"]'
    );
    closeButtons.forEach(btn => {
      btn.onclick = () => manager.closeEditUserModal();
    });

    const escHandler = e => {
      if (e.key === 'Escape') {
        manager.closeEditUserModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    modal.onclick = e => {
      if (e.target === modal) {
        manager.closeEditUserModal();
      }
    };

    const form = modal.querySelector('#editUserForm');
    if (form) {
      form.onsubmit = async e => {
        e.preventDefault();
        await manager.handleEditUserSubmit();
      };
    }

    modal.dataset.listenersBound = '1';
  };

  const createUserModalHTML = () => {
    const modal = document.createElement('div');
    modal.id = 'createUserModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('data-state', 'hidden');
    modal.classList.add('hidden');

    modal.innerHTML = `
        <div class="modal-content modal-premium" role="dialog" aria-labelledby="createUserTitle" aria-modal="true">
          <div class="modal-header">
            <h2 id="createUserTitle" class="modal-title">
              <i data-lucide="user-plus" aria-hidden="true"></i>
              Crear Nuevo Usuario
            </h2>
            <button 
              class="modal-close" 
              data-action="closeCreateUserModal"
              aria-label="Cerrar modal"
              title="Cerrar">
              <i data-lucide="x" aria-hidden="true"></i>
            </button>
          </div>

          <div class="modal-body">
            <form id="createUserForm" class="user-form">
              <!-- Email -->
              <div class="form-group">
                <label for="newUserEmail" class="form-label">
                  Email <span class="required">*</span>
                </label>
                <input 
                  type="email" 
                  id="newUserEmail" 
                  class="form-control modern-input"
                  placeholder="usuario@ejemplo.com"
                  required
                  autocomplete="email"
                  aria-required="true">
                <small class="form-help">El usuario recibirá un email para establecer su contraseña</small>
              </div>

              <!-- Nombre -->
              <div class="form-group">
                <label for="newUserName" class="form-label">
                  Nombre Completo <span class="required">*</span>
                </label>
                <input 
                  type="text" 
                  id="newUserName" 
                  class="form-control modern-input"
                  placeholder="Juan Pérez"
                  required
                  autocomplete="name"
                  aria-required="true">
              </div>

              <!-- Rol -->
              <div class="form-group">
                <label for="newUserRole" class="form-label">
                  Rol <span class="required">*</span>
                </label>
                <select 
                  id="newUserRole" 
                  class="form-control modern-input"
                  required
                  aria-required="true">
                  <option value="user">Usuario</option>
                  <option value="vendor">Vendedor</option>
                  <option value="moderator">Moderador</option>
                  <option value="admin">Administrador</option>
                </select>
                <small class="form-help">Selecciona el nivel de acceso del usuario</small>
              </div>

              <!-- Contraseña Temporal -->
              <div class="form-group">
                <label for="newUserPassword" class="form-label">
                  Contraseña Temporal <span class="required">*</span>
                </label>
                <input 
                  type="password" 
                  id="newUserPassword" 
                  class="form-control modern-input"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minlength="6"
                  autocomplete="new-password"
                  aria-required="true">
                <small class="form-help">El usuario deberá cambiarla en su primer inicio de sesión</small>
              </div>

              <!-- Botones -->
              <div class="modal-actions">
                <button 
                  type="button" 
                  class="btn-secondary"
                  data-action="closeCreateUserModal">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  class="btn-primary"
                  id="createUserSubmitBtn">
                  <i data-lucide="user-plus" aria-hidden="true"></i>
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

    return modal;
  };

  const createEditUserModalHTML = () => {
    const modal = document.createElement('div');
    modal.id = 'editUserModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('data-state', 'hidden');
    modal.classList.add('hidden');

    modal.innerHTML = `
        <div class="modal-content modal-premium" role="dialog" aria-labelledby="editUserTitle" aria-modal="true">
          <div class="modal-header">
            <h2 id="editUserTitle" class="modal-title">
              <i data-lucide="user-cog" aria-hidden="true"></i>
              Editar usuario
            </h2>
            <button
              class="modal-close"
              data-action="closeEditUserModal"
              aria-label="Cerrar modal"
              title="Cerrar">
              <i data-lucide="x" aria-hidden="true"></i>
            </button>
          </div>

          <div class="modal-body">
            <form id="editUserForm" class="user-form">
              <div class="form-group">
                <label for="editUserEmail" class="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="editUserEmail"
                  class="form-control modern-input"
                  readonly
                  aria-readonly="true">
                <small class="form-help">El email no se puede modificar.</small>
              </div>

              <div class="form-group">
                <label for="editUserName" class="form-label">
                  Nombre visible <span class="required">*</span>
                </label>
                <input
                  type="text"
                  id="editUserName"
                  class="form-control modern-input"
                  placeholder="Nombre del usuario"
                  required
                  aria-required="true">
                <small id="editUserHelp" class="form-help"></small>
              </div>

              <div class="modal-actions">
                <button
                  type="button"
                  class="btn-secondary"
                  data-action="closeEditUserModal">
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="btn-primary"
                  id="editUserSubmitBtn">
                  <i data-lucide="save" aria-hidden="true"></i>
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

    return modal;
  };

  const UsersModalManager = {
    openCreate(manager) {
      let modal = document.getElementById('createUserModal');
      if (!modal) {
        modal = createUserModalHTML();
        document.body.appendChild(modal);
      }

      const form = modal.querySelector('#createUserForm');
      if (form) {
        form.reset();
      }

      openModal(modal);
      bindCreateModal(modal, manager);
      safeLucideInit();

      setTimeout(() => {
        const firstInput = modal.querySelector('#newUserEmail');
        if (firstInput) firstInput.focus();
      }, 100);
    },
    openEdit(manager, user, isEditingSelf) {
      let modal = document.getElementById('editUserModal');
      if (!modal) {
        modal = createEditUserModalHTML();
        document.body.appendChild(modal);
      }

      const title = modal.querySelector('#editUserTitle');
      if (title) {
        title.textContent = isEditingSelf ? 'Editar mi perfil' : 'Editar usuario';
      }

      const emailInput = modal.querySelector('#editUserEmail');
      if (emailInput) {
        emailInput.value = user.email || '';
      }

      const nameInput = modal.querySelector('#editUserName');
      if (nameInput) {
        nameInput.value = manager.editingUserName || '';
      }

      const helpText = modal.querySelector('#editUserHelp');
      if (helpText) {
        helpText.textContent = isEditingSelf
          ? 'Solo puedes editar tu propio nombre de usuario.'
          : 'Actualiza el nombre visible del usuario.';
      }

      openModal(modal);
      bindEditModal(modal, manager);
      safeLucideInit();

      setTimeout(() => {
        if (nameInput) {
          nameInput.focus();
          nameInput.select();
        }
      }, 100);
    },
    closeCreate() {
      const modal = document.getElementById('createUserModal');
      closeModal(modal);
    },
    closeEdit() {
      const modal = document.getElementById('editUserModal');
      closeModal(modal);
    },
  };

  window.UsersModalManager = UsersModalManager;
}

export function initUsersModalManager() {
  if (window.__USERS_MODAL_MANAGER_INITED__) {
    return;
  }

  window.__USERS_MODAL_MANAGER_INITED__ = true;

  if (!window.UsersModalManager) {
    createUsersModalManager();
  }
}

if (typeof window !== 'undefined' && !window.__USERS_MODAL_MANAGER_NO_AUTO__) {
  initUsersModalManager();
}
