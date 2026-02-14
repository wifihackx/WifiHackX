/**
 * Users Data
 * Extracted from users-manager.js to isolate Firestore updates.
 */
'use strict';

function createUsersData() {
  const UsersData = {
    async withTimeout(promise, timeoutMs, timeoutMessage) {
      let timeoutId = null;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(timeoutMessage || 'Timeout')),
          timeoutMs
        );
      });
      try {
        return await Promise.race([promise, timeout]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
    async updateUserName(manager, userId, newName) {
      try {
        manager.log.debug('Actualizando nombre en Firebase...', manager.CAT.USERS);
        const db = window.firebase.firestore();

        await db.collection('users').doc(userId).update({
          displayName: newName,
          name: newName,
        });

        manager.log.debug('Nombre actualizado correctamente', manager.CAT.USERS);

        await manager.loadUsers();

        if (window.showNotification) {
          window.showNotification('Nombre actualizado correctamente', 'success');
        } else {
          alert('✅ Nombre actualizado correctamente');
        }
      } catch (error) {
        manager.log.error('Error al actualizar nombre', manager.CAT.USERS, error);
        alert('Error al actualizar nombre: ' + error.message);
      }
    },

    async loadUsers(manager) {
      manager._isLoadingUsers = true;
      manager.log.debug('Iniciando carga de usuarios...', manager.CAT.USERS);

      manager.log.info(
        'Cargando usuarios desde Firebase Auth y Firestore...',
        manager.CAT.FIREBASE || 'FIREBASE'
      );

      try {
        if (!window.firebase || !window.firebase.firestore) {
          manager.log.error(
            'Firebase Firestore no disponible',
            manager.CAT.FIREBASE || 'FIREBASE'
          );
          return;
        }

        if (window.permissionsHandler) {
          const hasPermission = await window.permissionsHandler.checkAndWarn();
          if (!hasPermission) {
            manager.log.error(
              'Sin permisos para cargar usuarios (PermissionsHandler)',
              manager.CAT.ADMIN
            );
            manager.showError(
              'No tienes permisos para acceder a esta sección. Consulta las instrucciones en el modal.'
            );
            return;
          }
        }

        const db = window.firebase.firestore();

        let authUsers = [];
        try {
          manager.log.debug(
            'Obteniendo usuarios de Firebase Auth...',
            manager.CAT.FIREBASE || 'FIREBASE'
          );
          let listUsersFunction = null;
          if (firebase?.functions) {
            listUsersFunction = firebase
              .functions()
              .httpsCallable('listAdminUsers');
          } else if (window.firebaseModular?.httpsCallable) {
            listUsersFunction = window.firebaseModular.httpsCallable('listAdminUsers');
          }
          if (listUsersFunction) {
            const authUsersResult = await UsersData.withTimeout(
              listUsersFunction(),
              8000,
              'Timeout llamando listAdminUsers'
            );
            authUsers = authUsersResult?.data?.users || [];
          }
        } catch (error) {
          manager.log.warn(
            'No se pudo cargar usuarios de Auth, se usará solo Firestore',
            manager.CAT.FIREBASE || 'FIREBASE',
            error
          );
          authUsers = [];
        }
        manager.log.debug(
          `Recibidos ${authUsers.length} usuarios de Auth`,
          manager.CAT.FIREBASE || 'FIREBASE'
        );

        manager.log.debug(
          'Obteniendo datos de Firestore...',
          manager.CAT.FIREBASE || 'FIREBASE'
        );
        const usersSnapshot = await UsersData.withTimeout(
          db.collection('users').get(),
          8000,
          'Timeout cargando usuarios de Firestore'
        );
        const firestoreUsers = {};

        usersSnapshot.forEach(doc => {
          firestoreUsers[doc.id] = doc.data();
        });
        manager.log.debug(
          `Recibidos ${usersSnapshot.size} documentos de Firestore`,
          manager.CAT.FIREBASE || 'FIREBASE'
        );

        manager.users = [];

        const shouldFallbackToFirestoreOnly = authUsers.length === 0;
        const sourceUsers = shouldFallbackToFirestoreOnly
          ? Object.entries(firestoreUsers).map(([id, data]) => ({
              uid: id,
              email: data.email,
              displayName: data.displayName || data.name,
              metadata: {},
              customClaims: data.customClaims || {},
            }))
          : authUsers;

        sourceUsers.forEach(authUser => {
          const firestoreData = firestoreUsers[authUser.uid] || {};

          const isSingleAdmin =
            authUser.uid === window.WFX_ADMIN?.uid && authUser.customClaims?.admin === true;

          if (isSingleAdmin) {
            manager.log.debug('DEBUG - Datos del admin', manager.CAT.USERS);
            manager.log.debug(`  - authUser: ${authUser.email}`, manager.CAT.USERS);
            manager.log.debug(
              `  - displayName (Auth): ${authUser.displayName || ''}`,
              manager.CAT.USERS
            );
            manager.log.debug(
              `  - customClaims: ${JSON.stringify(authUser.customClaims || {})}`,
              manager.CAT.USERS
            );
            manager.log.debug(
              `  - role (Firestore): ${firestoreData.role || ''}`,
              manager.CAT.USERS
            );
          }

          const role = isSingleAdmin ? 'admin' : 'user';

          const user = {
            id: authUser.uid,
            email: authUser.email || 'Sin email',
            name:
              authUser.displayName ||
              firestoreData.displayName ||
              firestoreData.name ||
              'Sin nombre',
            registeredDate: authUser.metadata?.creationTime
              ? new Date(authUser.metadata.creationTime)
                  .toISOString()
                  .split('T')[0]
              : firestoreData.createdAt
                ? new Date(firestoreData.createdAt.toDate())
                    .toISOString()
                    .split('T')[0]
                : 'N/A',
            status: firestoreData.banned ? 'banned' : 'active',
            role: role,
            joinDate: authUser.metadata?.creationTime
              ? new Date(authUser.metadata.creationTime).toLocaleDateString(
                  'es-ES'
                )
              : firestoreData.createdAt
                ? new Date(firestoreData.createdAt.toDate()).toLocaleDateString(
                    'es-ES'
                  )
                : 'N/A',
            banned: firestoreData.banned || false,
          };

          manager.users.push(user);
        });

        manager.currentUsers = manager.users;

        const uniqueIds = new Set(manager.users.map(u => u.id));
        if (uniqueIds.size !== manager.users.length) {
          manager.log.error(
            `DUPLICADOS DETECTADOS: ${manager.users.length} usuarios pero solo ${uniqueIds.size} IDs únicos`,
            manager.CAT.USERS
          );
          const uniqueUsers = [];
          const seenIds = new Set();
          manager.users.forEach(user => {
            if (!seenIds.has(user.id)) {
              seenIds.add(user.id);
              uniqueUsers.push(user);
            }
          });
          manager.users = uniqueUsers;
          manager.log.warn(
            `Duplicados eliminados, ahora hay ${manager.users.length} usuarios`,
            manager.CAT.USERS
          );
        }

        manager.log.debug(
          `${manager.users.length} usuarios cargados correctamente`,
          manager.CAT.USERS
        );
        manager.log.info(
          `${manager.users.length} usuarios cargados correctamente`,
          manager.CAT.USERS
        );
        manager.filterAndRender();
        manager.updateDashboardStats();
      } catch (error) {
        manager.log.error(
          'Error cargando usuarios',
          manager.CAT.FIREBASE || 'FIREBASE',
          error
        );

        if (
          window.permissionsHandler &&
          (error.code === 'permission-denied' ||
            error.message.includes('insufficient permissions'))
        ) {
          window.permissionsHandler.handleFirestoreError(
            error,
            'Cargar usuarios'
          );
        } else {
          manager.showError('Error cargando usuarios: ' + error.message);
        }
      } finally {
        manager._isLoadingUsers = false;
      }
    },
  };

  window.UsersData = UsersData;
}

export function initUsersData() {
  if (window.__USERS_DATA_INITED__) {
    return;
  }

  window.__USERS_DATA_INITED__ = true;

  if (!window.UsersData) {
    createUsersData();
  }
}
