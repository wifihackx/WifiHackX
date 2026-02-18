const path = require('path');
let admin;

function requireFirebaseAdmin() {
  try {
    // Preferred: run from a directory where firebase-admin is installed.
    // eslint-disable-next-line global-require
    return require('firebase-admin');
  } catch (_error) {
    // Fallback: when run from repo root, reuse functions' dependency tree.
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      return require(path.join(process.cwd(), 'functions', 'node_modules', 'firebase-admin'));
    } catch (error) {
      console.error(
        'firebase-admin no encontrado. Ejecuta este script desde la carpeta functions o instala firebase-admin.'
      );
      console.error('Detalles:', error.message);
      process.exit(1);
    }
  }
}

admin = requireFirebaseAdmin();

const uid = process.argv[2];
const serviceAccountPath = process.argv[3]; // optional now

if (!uid) {
  console.error(
    'Uso:\n' +
      '  node tools/set-admin-claim.cjs <uid> <ruta_service_account_json>\n' +
      '  node tools/set-admin-claim.cjs <uid>    (ADC: gcloud auth application-default login)'
  );
  process.exit(1);
}

try {
  if (serviceAccountPath) {
    const resolvedPath = path.resolve(serviceAccountPath);
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const serviceAccount = require(resolvedPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Keyless (recommended): uses Application Default Credentials.
    // Local: `gcloud auth application-default login`
    // CI: Workload Identity Federation / ADC.
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
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
