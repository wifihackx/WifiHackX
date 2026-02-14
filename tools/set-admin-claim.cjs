const path = require('path');
let admin;

try {
  admin = require('firebase-admin');
} catch (error) {
  console.error(
    'firebase-admin no encontrado. Ejecuta este script desde la carpeta functions o instala firebase-admin.'
  );
  process.exit(1);
}

const uid = process.argv[2];
const serviceAccountPath = process.argv[3];

if (!uid || !serviceAccountPath) {
  console.error(
    'Uso: node tools/set-admin-claim.cjs <uid> <ruta_service_account_json>'
  );
  process.exit(1);
}

const resolvedPath = path.resolve(serviceAccountPath);

try {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const serviceAccount = require(resolvedPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error('Error cargando service account:', error.message);
  process.exit(1);
}

(async () => {
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`✅ Custom claim admin=true asignado a UID: ${uid}`);
    process.exit(0);
  } catch (error) {
    console.error('Error asignando custom claims:', error);
    process.exit(1);
  }
})();
