const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function requireAuth(context) {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Debes iniciar sesión.'
    );
  }
  return context.auth.uid;
}

function requireAdmin(context) {
  const uid = requireAuth(context);
  const claims = context.auth && context.auth.token ? context.auth.token : {};
  if (claims.admin !== true) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Permisos de administrador requeridos.'
    );
  }
  return uid;
}

function getUserRef(uid) {
  return db.collection('users').doc(uid);
}

function hashCode(code, salt) {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${code}`)
    .digest('hex');
}

function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    codes.push(code);
  }
  return codes;
}

exports.generateTotpSecret = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  const userRef = getUserRef(uid);
  const snap = await userRef.get();
  const user = snap.exists ? snap.data() : {};

  if (user?.twoFactor?.totpEnabled) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'TOTP ya está habilitado.'
    );
  }

  const secret = authenticator.generateSecret();
  const label = user?.email || uid;
  const issuer = 'WifiHackX';
  const otpauthUrl = authenticator.keyuri(label, issuer, secret);
  const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

  await userRef.set(
    {
      twoFactor: {
        totpSecret: secret,
        totpEnabled: false,
        totpProvisionedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );

  return { otpauthUrl, qrDataUrl };
});

exports.verifyTotpAndEnable = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const code = (data && data.code ? String(data.code) : '').trim();
  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'Código requerido');
  }

  const userRef = getUserRef(uid);
  const snap = await userRef.get();
  const user = snap.exists ? snap.data() : {};
  const secret = user?.twoFactor?.totpSecret;
  if (!secret) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No hay secreto TOTP configurado.'
    );
  }

  const isValid = authenticator.check(code, secret);
  if (!isValid) {
    throw new functions.https.HttpsError('permission-denied', 'Código inválido');
  }

  await userRef.set(
    {
      twoFactor: {
        totpEnabled: true,
        totpVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );

  return { success: true };
});

exports.disableTotp = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  const userRef = getUserRef(uid);

  await userRef.set(
    {
      twoFactor: {
        totpEnabled: false,
        totpSecret: admin.firestore.FieldValue.delete(),
        backupCodes: admin.firestore.FieldValue.delete(),
      },
    },
    { merge: true }
  );

  return { success: true };
});

exports.generateBackupCodes = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  const userRef = getUserRef(uid);
  const snap = await userRef.get();
  const user = snap.exists ? snap.data() : {};

  if (!user?.twoFactor?.totpEnabled) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Activa TOTP antes de generar códigos.'
    );
  }

  const codes = generateBackupCodes(10);
  const salt = crypto.randomBytes(16).toString('hex');
  const hashes = codes.map(code => hashCode(code, salt));

  await userRef.set(
    {
      twoFactor: {
        backupCodes: {
          salt,
          hashes,
          used: [],
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
    },
    { merge: true }
  );

  return { codes };
});

exports.getTotpStatus = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  const userRef = getUserRef(uid);
  const snap = await userRef.get();
  const user = snap.exists ? snap.data() : {};
  const enabled = Boolean(user?.twoFactor?.totpEnabled);
  const hashes = user?.twoFactor?.backupCodes?.hashes || [];
  const used = user?.twoFactor?.backupCodes?.used || [];
  const remainingBackupCodes = Math.max(hashes.length - used.length, 0);
  const hasBackupCodes = remainingBackupCodes > 0;

  return { enabled, hasBackupCodes, remainingBackupCodes };
});

exports.verifyTotpForAdmin = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const code = (data && data.code ? String(data.code) : '').trim();
  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'Código requerido');
  }

  const userRef = getUserRef(uid);
  const snap = await userRef.get();
  const user = snap.exists ? snap.data() : {};
  const secret = user?.twoFactor?.totpSecret;
  if (!secret || !user?.twoFactor?.totpEnabled) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'TOTP no está habilitado.'
    );
  }

  const isValid = authenticator.check(code, secret);
  if (!isValid) {
    throw new functions.https.HttpsError('permission-denied', 'Código inválido');
  }

  return { success: true };
});

exports.verifyBackupCode = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const code = (data && data.code ? String(data.code) : '').trim();
  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'Código requerido');
  }

  const userRef = getUserRef(uid);
  const snap = await userRef.get();
  const user = snap.exists ? snap.data() : {};
  const backup = user?.twoFactor?.backupCodes;

  if (!backup || !backup.salt || !Array.isArray(backup.hashes)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No hay códigos de respaldo disponibles.'
    );
  }

  const hash = hashCode(code, backup.salt);
  const index = backup.hashes.indexOf(hash);
  if (index === -1) {
    throw new functions.https.HttpsError('permission-denied', 'Código inválido');
  }

  const used = Array.isArray(backup.used) ? backup.used : [];
  if (used.includes(hash)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Este código ya fue usado.'
    );
  }

  used.push(hash);

  await userRef.set(
    {
      twoFactor: {
        backupCodes: {
          used,
        },
      },
    },
    { merge: true }
  );

  return { success: true };
});

// System settings endpoints moved to functions-admin codebase to avoid conflicts.
