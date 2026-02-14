/**
 * Users Forms
 * Extracted from users-manager.js to handle create/edit submissions.
 */
'use strict';

function createUsersForms() {
  const UsersForms = {
    async handleCreate(manager) {
      const email = document.getElementById('newUserEmail').value.trim();
      const name = document.getElementById('newUserName').value.trim();
      const role = document.getElementById('newUserRole').value;
      const password = document.getElementById('newUserPassword').value;

      if (!email || !name || !role || !password) {
        alert('Por favor completa todos los campos obligatorios');
        return;
      }

      if (password.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert('Por favor ingresa un email válido');
        return;
      }

      if (role === 'admin') {
        alert(
          '🛡️ Solo existe un administrador en este sistema.\n\n' +
            'No se permite crear nuevos usuarios con rol ADMIN.'
        );
        return;
      }

      const submitBtn = document.getElementById('createUserSubmitBtn');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i data-lucide="loader" aria-hidden="true"></i> Creando...';

      try {
        manager.log.info(
          `Iniciando creación de usuario: ${email}`,
          manager.CAT.USERS
        );

        const currentUser = window.firebase.auth().currentUser;
        const currentUserEmail = currentUser ? currentUser.email : null;

        const auth = window.firebase.auth();
        const userCredential = await auth.createUserWithEmailAndPassword(
          email,
          password
        );
        const newUser = userCredential.user;

        manager.log.debug(
          `Usuario creado en Auth: ${newUser.uid}`,
          manager.CAT.FIREBASE || 'FIREBASE'
        );

        await newUser.updateProfile({
          displayName: name,
        });

        let emailSent = false;
        try {
          await newUser.sendEmailVerification();
          manager.log.info(
            'Email de verificación enviado al nuevo usuario',
            manager.CAT.USERS
          );
          emailSent = true;
        } catch (emailError) {
          manager.log.warn(
            'No se pudo enviar email de verificación',
            manager.CAT.ERR,
            emailError
          );
        }

        const db = window.firebase.firestore();
        await db.collection('users').doc(newUser.uid).set({
          email: email,
          displayName: name,
          name: name,
          role: role,
          createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
          banned: false,
          mustChangePassword: true,
          emailVerified: false,
        });

        await auth.signOut();

        if (currentUserEmail) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        manager.closeCreateUserModal();

        await new Promise(resolve => setTimeout(resolve, 500));
        await manager.loadUsers();

        const emailStatus = emailSent
          ? '📧 Se ha enviado un email de verificación'
          : '⚠️ No se pudo enviar el email de verificación (configura Firebase Email Templates)';

        const successMsg = `✅ Usuario creado: ${email}\n\n${emailStatus}\n\n🔑 Contraseña temporal: ${password}\n\n⚠️ El usuario debe cambiar su contraseña en el primer inicio de sesión.\n\n📝 IMPORTANTE: Comparte esta contraseña con el usuario de forma segura.`;

        if (window.NotificationSystem) {
          const notifMsg = emailSent
            ? `Usuario ${email} creado correctamente. Email de verificación enviado.`
            : `Usuario ${email} creado correctamente. Comparte la contraseña manualmente.`;

          window.NotificationSystem.success(notifMsg);
          setTimeout(() => {
            alert(successMsg);
          }, 500);
        } else {
          alert(successMsg);
        }
      } catch (error) {
        manager.log.error('Error al crear usuario', manager.CAT.USERS, error);

        let errorMsg = 'Error al crear usuario';
        if (error.code === 'auth/email-already-in-use') {
          errorMsg = 'Este email ya está registrado. Por favor usa otro email.';
        } else if (error.code === 'auth/invalid-email') {
          errorMsg = 'Email inválido. Verifica el formato.';
        } else if (error.code === 'auth/weak-password') {
          errorMsg = 'La contraseña es muy débil. Usa al menos 6 caracteres.';
        } else if (error.code === 'permission-denied') {
          errorMsg =
            'No tienes permisos para crear usuarios. Contacta al administrador.';
        } else {
          errorMsg = `Error: ${error.message}`;
        }

        if (window.NotificationSystem) {
          window.NotificationSystem.error(errorMsg);
        } else {
          alert('❌ ' + errorMsg);
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    },

    async handleEdit(manager) {
      const nameInput = document.getElementById('editUserName');
      const newName = nameInput ? nameInput.value.trim() : '';

      if (!manager.editingUserId) {
        alert('No se encontró el usuario a editar');
        return;
      }

      if (!newName) {
        alert('El nombre no puede estar vacío');
        return;
      }

      if (newName === manager.editingUserName) {
        manager.log.debug('No se realizaron cambios', manager.CAT.USERS);
        return;
      }

      const submitBtn = document.getElementById('editUserSubmitBtn');
      const originalText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<i data-lucide="loader" aria-hidden="true"></i> Guardando...';
      }

      try {
        await manager.updateUserName(manager.editingUserId, newName);
        manager.closeEditUserModal();
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    },
  };

  window.UsersForms = UsersForms;
}

export function initUsersForms() {
  if (window.__USERS_FORMS_INITED__) {
    return;
  }

  window.__USERS_FORMS_INITED__ = true;

  if (!window.UsersForms) {
    createUsersForms();
  }
}
