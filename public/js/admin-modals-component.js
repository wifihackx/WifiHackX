function setupAdminModalsComponent() {
  const init = () => {
  const adminModalsHTML = `
    <!-- Modal Formulario Usuario -->
    <div id="userFormModal" class="modal modal-hidden hidden" aria-hidden="true">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="userFormTitle">Crear Usuario</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="userForm">
                    <input type="hidden" id="userFormUserId" value="">

                    <div class="form-group">
                        <label for="userFormName">
                            <i data-lucide="user"></i>
                            Nombre Completo
                        </label>
                        <input type="text" id="userFormName" class="modern-input" placeholder="Ej: Juan Pérez" required>
                    </div>

                    <div class="form-group">
                        <label for="userFormEmail">
                            <i data-lucide="mail"></i>
                            Email
                        </label>
                        <input type="email" id="userFormEmail" class="modern-input" placeholder="usuario@ejemplo.com" required>
                    </div>

                    <div class="form-group" id="passwordGroup">
                        <label for="userFormPassword">
                            <i data-lucide="lock"></i>
                            Contraseña
                        </label>
                        <input type="password" id="userFormPassword" class="modern-input" placeholder="Mínimo 6 caracteres" minlength="6">
                        <small class="input-hint">Dejar en blanco para mantener la contraseña actual (solo
                            edición)</small>
                    </div>

                    <div class="form-group">
                        <label for="userFormRole">
                            <i data-lucide="shield"></i>
                            Rol
                        </label>
                        <select id="userFormRole" class="modern-input" required>
                            <option value="">Seleccionar rol...</option>
                            <option value="user">Usuario</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>

                    <div class="form-group-checkbox">
                        <label class="checkbox-label">
                            <input type="checkbox" id="userFormEmailVerified">
                            <span>Email verificado</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="modal-btn modal-btn-secondary">
                    Cancelar
                </button>
                <button type="button" class="modal-btn modal-btn-primary">
                    <i data-lucide="save"></i>
                    Guardar Usuario
                </button>
            </div>
        </div>
    </div>

    <!-- Modal Eliminar Usuario -->
    <div id="deleteUserModal" class="modal modal-hidden hidden" aria-hidden="true">
        <div class="modal-content modal-delete-modern">
            <div class="modal-delete-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </div>
            <h2 class="modal-delete-title">Eliminar Usuario</h2>
            <p class="modal-delete-message" id="deleteUserMessage">
                ¿Estás seguro de que deseas eliminar este usuario?
            </p>
            <p class="modal-delete-warning">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Esta acción NO se puede deshacer
            </p>
            <div class="modal-delete-actions">
                <button class="modal-btn modal-btn-secondary">Cancelar</button>
                <button class="modal-btn modal-btn-danger">
                    Eliminar Permanentemente
                </button>
            </div>
        </div>
    </div>

    <!-- Modal de Motivo de Baneo (Admin) -->
    <div id="banReasonModal" class="modal modal-hidden hidden" aria-hidden="true" hidden>
        <div class="modal-content modal-delete-modern">
            <div class="modal-delete-icon ban-modal-icon-gradient">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
            </div>
            <h2 class="modal-delete-title ban-modal-title-danger">
                Banear Usuario
            </h2>
            <p class="modal-delete-message">
                ¿Estás seguro de que deseas banear a
                <strong id="banUserEmailDisplay"></strong>?
            </p>

            <form id="banReasonForm" class="ban-form-layout">
                <input type="hidden" id="banTargetUserId">
                <input type="hidden" id="banTargetUserEmail">

                <div class="form-group">
                    <label for="banReasonSelect">
                        <i data-lucide="alert-circle"></i> Motivo del baneo
                    </label>
                    <select id="banReasonSelect" class="modern-input" required>
                        <option value="">Seleccionar motivo...</option>
                        <option value="spam">Spam / Contenido no deseado</option>
                        <option value="abuse">Comportamiento abusivo / Acoso</option>
                        <option value="fraud">Fraude / Estafa</option>
                        <option value="tos">Violación de Términos de Servicio</option>
                        <option value="security">Amenaza de Seguridad</option>
                        <option value="other">Otro motivo</option>
                    </select>
                </div>

                <!-- Duración del baneo -->
                <div class="form-group">
                    <label for="banDurationSelect">
                        <i data-lucide="clock"></i> Duración del baneo
                    </label>
                    <select id="banDurationSelect" class="modern-input" required>
                        <option value="permanent">Permanente</option>
                        <option value="1">1 día</option>
                        <option value="3">3 días</option>
                        <option value="7">7 días</option>
                        <option value="30">30 días</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="banReasonDetails" class="form-label-bold">
                        Detalles (mínimo 10 caracteres):
                    </label>
                    <textarea id="banReasonDetails" class="modern-input form-textarea-large" placeholder="Describe el motivo del baneo..." required minlength="10"></textarea>
                </div>
            </form>

            <p class="modal-delete-warning">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                El usuario será desconectado inmediatamente y no podrá volver a
                iniciar sesión.
            </p>

            <div class="modal-delete-actions">
                <button id="cancelBanBtn" class="modal-btn modal-btn-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Cancelar
                </button>
                <button id="confirmBanBtn" class="modal-btn modal-btn-danger">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                    </svg>
                    Confirmar Baneo
                </button>
            </div>
        </div>
    </div>

    <!-- Modal Usuario Baneado -->
    <div id="bannedUserModal" class="modal modal-hidden hidden" aria-hidden="true" hidden>
        <div class="modal-content modal-delete-modern">
            <div class="modal-delete-icon banned-modal-icon-gradient">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
            </div>
            <h2 class="modal-delete-title ban-modal-title-danger">
                Acceso Denegado
            </h2>
            <p class="modal-delete-message" id="bannedUserMessage">
                Tu cuenta ha sido suspendida.
            </p>
            <p class="modal-delete-warning">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Si crees que esto es un error, contacta al administrador.
            </p>
            <div class="modal-delete-actions">
                <button id="bannedLogoutBtn" class="modal-btn modal-btn-danger">Cerrar Sesión</button>
            </div>
        </div>
    </div>

    <!-- Modal Eliminar Anuncio - Diseño Premium -->
    <div id="deleteAnnouncementModal" class="modal-overlay delete-announcement-modal" data-state="hidden" aria-hidden="true">
        <div class="modal-content modal-delete-modern">
            <button class="modal-close-x" data-action="closeModal" aria-label="Cerrar modal">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            
            <div class="modal-delete-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
            </div>

            <h2 class="modal-delete-title">Eliminar Anuncio</h2>
            
            <p class="modal-delete-message">
                ¿Estás seguro de que deseas <strong>eliminar permanentemente</strong> este anuncio?
            </p>

            <div class="modal-delete-warning-box">
                <p class="modal-delete-warning-title">Esta acción:</p>
                <ul class="modal-delete-warning-list">
                    <li>Eliminará el anuncio de la base de datos</li>
                    <li>Removerá todas las imágenes asociadas</li>
                    <li>NO se puede deshacer</li>
                </ul>
            </div>

            <div class="modal-delete-checkbox-container">
                <label class="modal-delete-checkbox-label">
                    <input type="checkbox" id="confirmDeleteCheckbox" class="modal-delete-checkbox">
                    <span class="modal-delete-checkbox-text">
                        Entiendo que esta acción es irreversible y eliminará el anuncio permanentemente
                    </span>
                </label>
            </div>

            <div class="modal-delete-actions">
                <button class="modal-btn modal-btn-secondary" data-action="closeModal">
                    Cancelar
                </button>
                <button id="confirmDeleteAnnouncementBtn" class="modal-btn modal-btn-danger" disabled>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Sí, Eliminar Permanentemente
                </button>
            </div>
        </div>
    </div>
    `;

  // Limpiar modales antiguos si existen para evitar duplicados
  const oldUserModal = document.getElementById('userFormModal');
  if (oldUserModal) oldUserModal.remove();

  const oldDeleteUserModal = document.getElementById('deleteUserModal');
  if (oldDeleteUserModal) oldDeleteUserModal.remove();

  // IMPORTANTE: Remover modal de baneo legacy que viene en el HTML estático
  const oldBanModal = document.getElementById('banReasonModal');
  if (oldBanModal) {
    console.info('[AdminModals] Removiendo modal de baneo legacy');
    oldBanModal.remove();
  }

  const oldBannedUserModal = document.getElementById('bannedUserModal');
  if (oldBannedUserModal) oldBannedUserModal.remove();

  const oldDeleteAnnModal = document.getElementById('deleteAnnouncementModal');
  if (oldDeleteAnnModal) oldDeleteAnnModal.remove();

  document.body.insertAdjacentHTML('beforeend', adminModalsHTML);
    console.info('[AdminModals] Modales modernos inyectados correctamente');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

export function initAdminModalsComponent() {
  if (window.__ADMIN_MODALS_COMPONENT_INITED__) {
    return;
  }

  window.__ADMIN_MODALS_COMPONENT_INITED__ = true;
  setupAdminModalsComponent();
}

if (typeof window !== 'undefined' && !window.__ADMIN_MODALS_COMPONENT_NO_AUTO__) {
  initAdminModalsComponent();
}



