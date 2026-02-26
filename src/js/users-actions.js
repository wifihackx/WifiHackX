/**
 * Users Actions
 * Extracted from users-manager.js to isolate export/sync/ban/delete logic.
 */
'use strict';

function createUsersActions() {
  const resolveFunctionsBaseUrl = () => {
    const projectId =
      window.firebaseConfig &&
      typeof window.firebaseConfig.projectId === 'string' &&
      window.firebaseConfig.projectId.trim();
    if (
      window.RuntimeConfigUtils &&
      typeof window.RuntimeConfigUtils.getCloudFunctionsBaseUrl === 'function'
    ) {
      const url = window.RuntimeConfigUtils.getCloudFunctionsBaseUrl(
        projectId || '',
        'us-central1'
      );
      if (url) return url;
    }
    const fallbackProjectId =
      projectId ||
      window.RUNTIME_CONFIG?.firebase?.projectId ||
      window.firebase?.app?.()?.options?.projectId ||
      '';
    if (fallbackProjectId) {
      return `https://us-central1-${fallbackProjectId}.cloudfunctions.net`;
    }
    return '';
  };

  const UsersActions = {
    exportUsers(manager) {
      manager.log.info('Exportando usuarios a CSV...', manager.CAT.USERS);

      if (manager.users.length === 0) {
        alert('No hay usuarios para exportar');
        return;
      }

      const headers = ['Email', 'Nombre', 'Rol', 'Estado', 'Fecha Registro'];
      const rows = manager.users.map(u => [
        u.email,
        u.name,
        u.role,
        u.banned ? 'Baneado' : 'Activo',
        u.joinDate,
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      manager.log.info('Usuarios exportados correctamente', manager.CAT.USERS);
      if (window.showNotification) {
        window.showNotification('Usuarios exportados correctamente', 'success');
      }
    },

    createUser(manager) {
      manager.log.debug('Abriendo modal de creación de usuario...', manager.CAT.USERS);
      manager.showCreateUserModal();
    },

    async syncUsers(manager) {
      manager.log.info('Iniciando sincronización de usuarios...', manager.CAT.USERS);

      try {
        const confirmed = confirm(
          '⚠️ Sincronizar usuarios desde Firebase Auth\n\n' +
            'Esta acción creará documentos en Firestore para los usuarios que existen en Auth pero no en la base de datos.\n\n' +
            '¿Deseas continuar?'
        );

        if (!confirmed) {
          manager.log.info('Sincronización cancelada por el usuario', manager.CAT.USERS);
          return;
        }

        if (window.showNotification) {
          window.showNotification('Sincronizando usuarios...', 'info');
        }

        const currentUser = window.firebase.auth().currentUser;
        if (!currentUser) {
          throw new Error('No hay usuario autenticado');
        }

        const idToken = await currentUser.getIdToken(true);
        const baseUrl = resolveFunctionsBaseUrl();
        if (!baseUrl) {
          throw new Error('Cloud Functions base URL no configurada');
        }
        const functionUrl = `${baseUrl}/syncUsersToFirestore`;

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          let errorData = null;
          try {
            errorData = await response.json();
          } catch (_e) {
            const text = await response.text();
            throw new Error(text || `HTTP error ${response.status}`);
          }
          throw new Error(errorData?.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          manager.log.info(
            `Sincronización completada: ${data.syncedUsers} usuarios creados`,
            manager.CAT.USERS
          );

          if (data.syncedUsers > 0) {
            setTimeout(() => {
              const userList = data.newUsers
                ? data.newUsers.map(u => `• ${u.email}`).join('\n')
                : 'Sin detalles';
              alert(
                `✅ Sincronización completada\n\n` +
                  `Usuarios creados: ${data.syncedUsers}\n` +
                  `Total en Firestore: ${data.totalFirestoreUsers + data.syncedUsers}\n\n` +
                  `Nuevos usuarios:\n${userList}`
              );
            }, 500);
          } else {
            setTimeout(() => {
              alert(
                `ℹ️ No hay usuarios para sincronizar\n\n` +
                  `Todos los usuarios de Firebase Auth ya existen en Firestore.\n` +
                  `Total: ${data.totalAuthUsers} usuarios`
              );
            }, 500);
          }
        } else {
          throw new Error(data.message || 'Error desconocido en la sincronización');
        }
      } catch (error) {
        manager.log.error('Error sincronizando usuarios', manager.CAT.USERS, error);

        let errorMessage = 'Error desconocido';
        if (error.message) {
          errorMessage = error.message;
        }

        if (window.showNotification) {
          window.showNotification(`❌ Error: ${errorMessage}`, 'error');
        } else {
          alert(`❌ Error sincronizando usuarios:\n${errorMessage}`);
        }
      }
    },

    banUser(manager, userId, userEmail) {
      const user = manager.users.find(u => u.id === userId);
      if (!user) {
        alert('Usuario no encontrado');
        return;
      }

      if (
        user.role === 'admin' ||
        (typeof manager._isProtectedAdmin === 'function' && manager._isProtectedAdmin(user))
      ) {
        manager.log.error('BLOQUEADO: Intento de banear administrador', manager.CAT.ADMIN);
        alert(
          'ERROR DE SEGURIDAD\n\nNo se puede banear a un administrador.\n\nSi necesitas remover privilegios de administrador, contacta al super administrador.'
        );
        return;
      }

      if (window.BanSystem && window.BanSystem.showBanModal) {
        window.BanSystem.showBanModal(userId, userEmail);
      } else if (window.showBanModal) {
        window.showBanModal(userId, userEmail);
      } else {
        manager.log.error('Sistema de baneo no disponible', manager.CAT.ADMIN);
        alert('Error: Sistema de baneo no disponible');
      }
    },

    async unbanUser(manager, userId) {
      const user = manager.users.find(u => u.id === userId);
      if (!user) {
        alert('Usuario no encontrado');
        return;
      }

      const confirm = window.confirm(`¿Desbanear a ${user.email}?`);
      if (!confirm) return;

      try {
        if (window.BanSystem && window.BanSystem.unbanUser) {
          await window.BanSystem.unbanUser(userId);
        } else if (window.unbanUser) {
          await window.unbanUser(userId);
        } else {
          throw new Error('Sistema de baneo no disponible');
        }

        await manager.loadUsers();
        if (window.showNotification) {
          window.showNotification('Usuario desbaneado correctamente', 'success');
        }
      } catch (error) {
        manager.log.error('Error al desbanear', manager.CAT.USERS, error);
        alert('Error al desbanear: ' + error.message);
      }
    },

    async deleteUser(manager, userId) {
      const user = manager.users.find(u => u.id === userId);
      if (!user) {
        alert('Usuario no encontrado');
        return;
      }

      if (user.role === 'admin' || manager._isProtectedAdmin(user)) {
        manager.log.error(
          `BLOQUEADO: Intento de eliminar administrador protegido: ${user.email}`,
          manager.CAT.ADMIN
        );
        const allowlist =
          typeof manager._getAdminAllowlist === 'function'
            ? manager._getAdminAllowlist()
            : { emails: [], uids: [] };
        const protectedEmails = allowlist.emails || [];
        const protectedUids = allowlist.uids || [];
        let protectedList = '';
        if (protectedEmails.length) {
          protectedList += protectedEmails.map(email => `- ${email}`).join('\n');
        }
        if (protectedUids.length) {
          protectedList +=
            (protectedList ? '\n' : '') + protectedUids.map(uid => `- UID: ${uid}`).join('\n');
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

      const confirm1 = window.confirm(
        `⚠️ ADVERTENCIA: Eliminar a ${user.email}?\n\nEsta acción NO se puede deshacer.`
      );
      if (!confirm1) return;

      const confirm2 = window.confirm(
        `🔴 ÚLTIMA CONFIRMACIÓN\n\n¿Estás 100% seguro de eliminar a ${user.email}?`
      );
      if (!confirm2) return;

      try {
        const db = window.firebase.firestore();
        await db.collection('users').doc(userId).delete();

        await manager.loadUsers();
        if (window.showNotification) {
          window.showNotification('Usuario eliminado correctamente', 'success');
        }
      } catch (error) {
        manager.log.error('Error al eliminar', manager.CAT.USERS, error);
        alert('Error al eliminar: ' + error.message);
      }
    },
  };

  window.UsersActions = UsersActions;
}

export function initUsersActions() {
  if (window.__USERS_ACTIONS_INITED__) {
    return;
  }

  window.__USERS_ACTIONS_INITED__ = true;

  if (!window.UsersActions) {
    createUsersActions();
  }
}

if (typeof window !== 'undefined' && !window.__USERS_ACTIONS_NO_AUTO__) {
  initUsersActions();
}
