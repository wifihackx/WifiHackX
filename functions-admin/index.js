const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function requireAdmin(context) {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Debes iniciar sesión.'
    );
  }
  const claims = context.auth.token || {};
  if (claims.admin !== true) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Permisos de administrador requeridos.'
    );
  }
  return context.auth.uid;
}

exports.getSystemSettings = functions.https.onCall(async (_data, context) => {
  requireAdmin(context);
  const ref = db.collection('settings').doc('system-config');
  const snap = await ref.get();
  return {
    exists: snap.exists,
    data: snap.exists ? snap.data() : {},
  };
});

exports.setSystemSettings = functions.https.onCall(async (data, context) => {
  const uid = requireAdmin(context);
  const payload = data && data.settings ? data.settings : data;
  if (!payload || typeof payload !== 'object') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Payload inválido.'
    );
  }

  const normalized = {
    general: payload.general || {},
    security: payload.security || {},
    email: payload.email || {},
  };

  const ref = db.collection('settings').doc('system-config');
  const publicRef = db.collection('publicSettings').doc('system-config');

  await ref.set(
    {
      ...normalized,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true }
  );

  await publicRef.set(
    {
      general: {
        siteName: normalized.general?.siteName || '',
        contactEmail: normalized.general?.contactEmail || '',
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true }
  );

  return { success: true };
});
