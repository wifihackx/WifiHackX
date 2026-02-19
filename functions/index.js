const functions = require('firebase-functions/v1');
const { onCall: onCallV2, HttpsError: HttpsErrorV2 } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const REGISTRATION_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const REGISTRATION_RATE_LIMIT_MAX = 3;
const BLOCKED_EMAIL_DOMAINS = new Set([
  'guerrillamail.com',
  'tempr.email',
  'temprano.com',
  'mailinator.com',
  '10minutemail.com',
  'yopmail.com',
]);
const BOT_USER_AGENT_REGEX =
  /(bot|crawl|spider|headless|puppeteer|playwright|selenium|phantom|python-requests|curl|wget)/i;
const FUNCTIONS_DEBUG = process.env.FUNCTIONS_DEBUG === '1';
const APPCHECK_ENFORCE = process.env.APPCHECK_ENFORCE !== '0';
const APPCHECK_ENFORCE_HTTP = process.env.APPCHECK_ENFORCE_HTTP === '1';

function debugFunctionLog(message) {
  if (FUNCTIONS_DEBUG) {
    console.info(message);
  }
}

function isFunctionsEmulator() {
  return (
    process.env.FUNCTIONS_EMULATOR === 'true' ||
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)
  );
}

function shouldEnforceAppCheck() {
  // Safe mode:
  // - Enforce in deployed environments by default.
  // - Skip in emulator/local.
  return APPCHECK_ENFORCE && !isFunctionsEmulator() && !!process.env.GCLOUD_PROJECT;
}

function assertAppCheckV1(context, name = 'callable') {
  if (!shouldEnforceAppCheck()) return;
  const app = context && context.app ? context.app : null;
  if (app && app.appId) return;
  throw new functions.https.HttpsError(
    'failed-precondition',
    `App Check requerido (${name}).`
  );
}

async function assertAppCheckHttp(request, name = 'http') {
  if (!shouldEnforceAppCheck() || !APPCHECK_ENFORCE_HTTP) return;
  const token = String(request.headers['x-firebase-appcheck'] || '').trim();
  if (!token) {
    throw new Error(`missing-app-check-token:${name}`);
  }
  await admin.appCheck().verifyToken(token);
}

function secureOnCall(name, handler) {
  return functions.https.onCall(async (data, context) => {
    assertAppCheckV1(context, name);
    return handler(data, context);
  });
}

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
  const isAdmin =
    claims.admin === true ||
    claims.role === 'admin' ||
    claims.role === 'super_admin';
  if (!isAdmin) {
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

function parseAllowlist(raw) {
  return String(raw || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

async function isAllowlistedAdmin(uid, email) {
  try {
    const snap = await db.collection('settings').doc('system-config').get();
    const emailsRaw = snap.get('security.adminAllowlistEmails') || '';
    const uidsRaw = snap.get('security.adminAllowlistUids') || '';
    const allowEmails = parseAllowlist(emailsRaw);
    const allowUids = String(uidsRaw)
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    const normalizedEmail = String(email || '').toLowerCase();
    return (
      (uid && allowUids.includes(uid)) ||
      (normalizedEmail && allowEmails.includes(normalizedEmail))
    );
  } catch (_e) {
    return false;
  }
}

async function getBlockedRegistrationDomains() {
  const domains = new Set(BLOCKED_EMAIL_DOMAINS);
  try {
    const snap = await db.collection('settings').doc('system-config').get();
    const dynamicRaw =
      snap.get('security.blockedRegistrationEmailDomains') || '';
    parseAllowlist(dynamicRaw).forEach(domain => domains.add(domain));
  } catch (_e) {}
  return domains;
}

async function isFirestoreRoleAdmin(uid) {
  try {
    if (!uid) return false;
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return false;
    const role = String(snap.data()?.role || '').toLowerCase();
    return role === 'admin' || role === 'super_admin';
  } catch (_e) {
    return false;
  }
}

async function writeSecurityAudit(event) {
  try {
    await db.collection('security_logs').add({
      ...event,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('[security_audit] failed:', error.message);
  }
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

function wrapV1Callable(name, handler) {
  return secureOnCall(name, async (data, context) => {
    debugFunctionLog(`[2fa-callable] ${name} v1`);
    return handler(data, context);
  });
}

function wrapV2CallableNamed(name, v1Handler) {
  return onCallV2(async request => {
    debugFunctionLog(`[2fa-callable] ${name} v2`);
    try {
      if (shouldEnforceAppCheck()) {
        const app = request?.app || null;
        if (!app || !app.appId) {
          throw new HttpsErrorV2(
            'failed-precondition',
            `App Check requerido (${name}).`
          );
        }
      }
      return await v1Handler(request?.data || {}, {
        auth: request?.auth || null,
        app: request?.app || null,
        rawRequest: request?.rawRequest || null,
      });
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw new HttpsErrorV2(error.code, error.message, error.details);
      }
      throw error;
    }
  });
}

function normalizeSixDigitCode(value) {
  const normalized = String(value || '').replace(/\D/g, '').slice(0, 6);
  return /^\d{6}$/.test(normalized) ? normalized : '';
}

async function generateTotpSecretHandler(_data, context) {
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
}

exports.generateTotpSecret = wrapV1Callable(
  'generateTotpSecret',
  generateTotpSecretHandler
);
exports.generateTotpSecretV2 = wrapV2CallableNamed(
  'generateTotpSecret',
  generateTotpSecretHandler
);

async function verifyTotpAndEnableHandler(data, context) {
  const uid = requireAuth(context);
  const code = normalizeSixDigitCode(data?.code);
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
}

exports.verifyTotpAndEnable = wrapV1Callable(
  'verifyTotpAndEnable',
  verifyTotpAndEnableHandler
);
exports.verifyTotpAndEnableV2 = wrapV2CallableNamed(
  'verifyTotpAndEnable',
  verifyTotpAndEnableHandler
);

async function disableTotpHandler(_data, context) {
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
}

exports.disableTotp = wrapV1Callable('disableTotp', disableTotpHandler);
exports.disableTotpV2 = wrapV2CallableNamed('disableTotp', disableTotpHandler);

async function generateBackupCodesHandler(_data, context) {
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
}

exports.generateBackupCodes = wrapV1Callable(
  'generateBackupCodes',
  generateBackupCodesHandler
);
exports.generateBackupCodesV2 = wrapV2CallableNamed(
  'generateBackupCodes',
  generateBackupCodesHandler
);

async function getTotpStatusHandler(_data, context) {
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
}

exports.getTotpStatus = wrapV1Callable('getTotpStatus', getTotpStatusHandler);
exports.getTotpStatusV2 = wrapV2CallableNamed(
  'getTotpStatus',
  getTotpStatusHandler
);

async function verifyTotpForAdminHandler(data, context) {
  const uid = requireAuth(context);
  const code = normalizeSixDigitCode(data?.code);
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
}

exports.verifyTotpForAdmin = wrapV1Callable(
  'verifyTotpForAdmin',
  verifyTotpForAdminHandler
);
exports.verifyTotpForAdminV2 = wrapV2CallableNamed(
  'verifyTotpForAdmin',
  verifyTotpForAdminHandler
);

async function verifyBackupCodeHandler(data, context) {
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
}

exports.verifyBackupCode = wrapV1Callable(
  'verifyBackupCode',
  verifyBackupCodeHandler
);
exports.verifyBackupCodeV2 = wrapV2CallableNamed(
  'verifyBackupCode',
  verifyBackupCodeHandler
);

/**
 * Secure admin-claims assignment.
 * Rules:
 *  - Caller must be authenticated.
 *  - Caller can set claims only for self unless already admin.
 *  - Self-bootstrap is allowed only if caller email is in ADMIN_BOOTSTRAP_EMAILS.
 */
exports.setAdminClaims = secureOnCall('setAdminClaims', async (data, context) => {
  const actorUid = requireAuth(context);
  const actorEmail = String(context.auth?.token?.email || '').toLowerCase();
  const actorClaims = context.auth?.token || {};
  const isActorAdmin =
    actorClaims.admin === true ||
    actorClaims.role === 'admin' ||
    actorClaims.role === 'super_admin';

  const requestedUid = String(data?.uid || actorUid).trim();
  const requestedEmail = String(data?.email || '').trim().toLowerCase();
  const isSelfTarget = requestedUid === actorUid;

  if (!requestedUid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid requerido');
  }

  if (!isActorAdmin) {
    if (!isSelfTarget) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Solo administradores pueden modificar claims de otros usuarios.'
      );
    }
    const bootstrapEmails = parseAllowlist(process.env.ADMIN_BOOTSTRAP_EMAILS);
    if (!actorEmail || !bootstrapEmails.includes(actorEmail)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Tu cuenta no está autorizada para bootstrap admin.'
      );
    }
  }

  const targetUser = await admin.auth().getUser(requestedUid);
  if (!targetUser?.uid) {
    throw new functions.https.HttpsError('not-found', 'Usuario no encontrado');
  }
  if (requestedEmail && targetUser.email?.toLowerCase() !== requestedEmail) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email no coincide con el UID objetivo.'
    );
  }

  const newClaims = {
    ...(targetUser.customClaims || {}),
    admin: true,
    role: 'admin',
    configuredAt: new Date().toISOString(),
    configuredBy: actorEmail || actorUid,
  };

  await admin.auth().setCustomUserClaims(targetUser.uid, newClaims);
  await getUserRef(targetUser.uid).set(
    {
      uid: targetUser.uid,
      email: targetUser.email || '',
      role: 'admin',
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    },
    { merge: true }
  );

  await writeSecurityAudit({
    type: 'admin_claims_set',
    actorUid,
    actorEmail,
    targetUid: targetUser.uid,
    targetEmail: targetUser.email || '',
    actorIsAdmin: isActorAdmin,
    source: 'httpsCallable:setAdminClaims',
  });

  return {
    success: true,
    targetUid: targetUser.uid,
    targetEmail: targetUser.email || '',
    actorUid,
  };
});

function isAdminToken(token) {
  return (
    token?.admin === true ||
    token?.role === 'admin' ||
    token?.role === 'super_admin'
  );
}

async function requireAdminOrAllowlist(context) {
  const uid = requireAuth(context);
  const claims = context.auth?.token || {};
  const email = String(claims.email || '').toLowerCase();
  if (isAdminToken(claims)) return uid;
  const allowlisted = await isAllowlistedAdmin(uid, email);
  if (allowlisted) return uid;
  const roleAdmin = await isFirestoreRoleAdmin(uid);
  if (roleAdmin) return uid;
  throw new functions.https.HttpsError(
    'permission-denied',
    'Permisos de administrador requeridos.'
  );
}

function getRequestIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return (
    request.ip ||
    request.connection?.remoteAddress ||
    request.socket?.remoteAddress ||
    ''
  );
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getEmailDomain(email) {
  const at = email.lastIndexOf('@');
  if (at === -1) return '';
  return email.slice(at + 1).toLowerCase();
}

function isBotUserAgent(userAgent) {
  return BOT_USER_AGENT_REGEX.test(String(userAgent || ''));
}

function hashRateLimitKey(raw) {
  const salt = String(process.env.RATE_LIMIT_SALT || 'wifihackx-rate-limit');
  return crypto
    .createHash('sha256')
    .update(`${salt}:${String(raw || '')}`)
    .digest('hex');
}

function parsePositiveIntBounded(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.trunc(numeric);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

async function enforceRegistrationRateLimit(identityKey) {
  const docId = hashRateLimitKey(identityKey);
  const ref = db.collection('registration_rate_limits').doc(docId);
  const now = Date.now();

  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const windowStartMs = Number(data.windowStartMs || 0);
    const currentCount = Number(data.count || 0);
    const inWindow = now - windowStartMs < REGISTRATION_RATE_LIMIT_WINDOW_MS;
    const nextCount = inWindow ? currentCount + 1 : 1;

    tx.set(
      ref,
      {
        windowStartMs: inWindow ? windowStartMs : now,
        count: nextCount,
        lastAttemptMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      blocked: inWindow && currentCount >= REGISTRATION_RATE_LIMIT_MAX,
      count: nextCount,
    };
  });

  return result;
}

async function preRegisterGuardHandler(data, context) {
  const request = context?.rawRequest || {};
  const ip = getRequestIp(request);
  const userAgentRaw = String(
    request.headers?.['user-agent'] || data?.userAgent || ''
  );
  const userAgent = userAgentRaw.slice(0, 300);
  const website = String(data?.website || '').trim();
  const email = normalizeEmail(data?.email);
  const emailDomain = getEmailDomain(email);
  const testMode = Boolean(data?.testMode);
  const blockedDomains = await getBlockedRegistrationDomains();

  if (testMode) {
    await requireAdminOrAllowlist(context);
    const reasons = [];
    if (website) reasons.push('honeypot_filled');
    if (!isValidEmail(email)) reasons.push('invalid_email');
    if (emailDomain && blockedDomains.has(emailDomain)) {
      reasons.push('blocked_email_domain');
    }
    if (isBotUserAgent(userAgent)) reasons.push('bot_user_agent');
    return {
      allowed: reasons.length === 0,
      simulated: true,
      wouldBlock: reasons.length > 0,
      reasons,
      inspected: {
        email,
        emailDomain,
        hasWebsite: Boolean(website),
        userAgent,
      },
    };
  }

  if (website) {
    await writeSecurityAudit({
      type: 'registration_blocked',
      reason: 'honeypot_filled',
      ip,
      email,
      emailDomain,
      userAgent,
      source: 'preRegisterGuard',
    });
    throw new functions.https.HttpsError(
      'permission-denied',
      'Registro bloqueado.',
      { reason: 'honeypot_filled' }
    );
  }

  if (!isValidEmail(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Email inválido.', {
      reason: 'invalid_email',
    });
  }

  if (emailDomain && blockedDomains.has(emailDomain)) {
    await writeSecurityAudit({
      type: 'registration_blocked',
      reason: 'blocked_email_domain',
      ip,
      email,
      emailDomain,
      userAgent,
      source: 'preRegisterGuard',
    });
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Dominio de email no permitido.',
      { reason: 'blocked_email_domain' }
    );
  }

  if (isBotUserAgent(userAgent)) {
    await writeSecurityAudit({
      type: 'registration_blocked',
      reason: 'bot_user_agent',
      ip,
      email,
      emailDomain,
      userAgent,
      source: 'preRegisterGuard',
    });
    throw new functions.https.HttpsError(
      'permission-denied',
      'Acceso denegado.',
      { reason: 'bot_user_agent' }
    );
  }

  const identity = ip || `email:${email}`;
  const limit = await enforceRegistrationRateLimit(identity);
  if (limit.blocked) {
    await writeSecurityAudit({
      type: 'registration_blocked',
      reason: 'rate_limit',
      ip,
      email,
      emailDomain,
      userAgent,
      count: limit.count,
      source: 'preRegisterGuard',
    });
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Too many requests. Try again later.',
      { reason: 'rate_limit' }
    );
  }

  return {
    allowed: true,
    checks: {
      emailDomainBlocked: false,
      botUserAgentBlocked: false,
      rateLimited: false,
    },
  };
}

exports.preRegisterGuard = secureOnCall(
  'preRegisterGuard',
  preRegisterGuardHandler
);
exports.preRegisterGuardV2 = wrapV2CallableNamed(
  'preRegisterGuard',
  preRegisterGuardHandler
);

async function getRegistrationBlockStatsHandler(_data, context) {
  await requireAdminOrAllowlist(context);

  const nowMs = Date.now();
  const oneHourAgoMs = nowMs - 60 * 60 * 1000;
  const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
  const rows = await db
    .collection('security_logs')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();

  let blockedLastHour = 0;
  let blockedLastDay = 0;
  const byReason = {};

  rows.forEach(doc => {
    const row = doc.data() || {};
    if (row.type !== 'registration_blocked') return;
    const createdAtMs = row.createdAt?.toDate?.()?.getTime?.() || 0;
    if (!createdAtMs) return;

    if (createdAtMs >= oneDayAgoMs) {
      blockedLastDay += 1;
      const reason = String(row.reason || 'unknown');
      byReason[reason] = (byReason[reason] || 0) + 1;
    }
    if (createdAtMs >= oneHourAgoMs) {
      blockedLastHour += 1;
    }
  });

  return {
    blockedLastHour,
    blockedLastDay,
    byReason,
    thresholdWarnHour: 10,
  };
}

exports.getRegistrationBlockStats = secureOnCall(
  'getRegistrationBlockStats',
  getRegistrationBlockStatsHandler
);
exports.getRegistrationBlockStatsV2 = wrapV2CallableNamed(
  'getRegistrationBlockStats',
  getRegistrationBlockStatsHandler
);

function mergeCounterInto(target, source) {
  const out = target || {};
  const src = source || {};
  Object.keys(src).forEach(key => {
    out[key] = (out[key] || 0) + Number(src[key] || 0);
  });
  return out;
}

function topEntriesFromCounter(counter, limit = 10) {
  return Object.entries(counter || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit)
    .map(([key, value]) => ({ key, value: Number(value || 0) }));
}

async function getSecurityLogsDailyStatsHandler(data, context) {
  await requireAdminOrAllowlist(context);

  const rawDays = Number(data?.days || 30);
  const days = Number.isFinite(rawDays)
    ? Math.max(1, Math.min(90, Math.floor(rawDays)))
    : 30;

  const snap = await db
    .collection('security_logs_daily')
    .orderBy('dateKey', 'desc')
    .limit(days)
    .get();

  const rows = snap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .sort((a, b) => String(a.dateKey || '').localeCompare(String(b.dateKey || '')));

  const totals = {
    logs: 0,
    registrationBlocked: 0,
    adminActions: 0,
  };
  let byType = {};
  let byReason = {};
  let byAdminAction = {};
  let byAdminActor = {};

  const series = rows.map(row => {
    const dailyTotals = row.totals || {};
    const logs = Number(dailyTotals.logs || 0);
    const registrationBlocked = Number(dailyTotals.registrationBlocked || 0);
    const adminActions = Number(dailyTotals.adminActions || 0);

    totals.logs += logs;
    totals.registrationBlocked += registrationBlocked;
    totals.adminActions += adminActions;

    byType = mergeCounterInto(byType, row.byType || {});
    byReason = mergeCounterInto(byReason, row.byReason || {});
    byAdminAction = mergeCounterInto(byAdminAction, row.byAdminAction || {});
    byAdminActor = mergeCounterInto(byAdminActor, row.byAdminActor || {});

    return {
      dateKey: row.dateKey || row.id || '',
      logs,
      registrationBlocked,
      adminActions,
    };
  });

  const firstDate = series.length ? series[0].dateKey : null;
  const lastDate = series.length ? series[series.length - 1].dateKey : null;

  return {
    daysRequested: days,
    daysReturned: series.length,
    dateFrom: firstDate,
    dateTo: lastDate,
    totals,
    series,
    byType,
    byReason,
    byAdminAction,
    topAdminActions: topEntriesFromCounter(byAdminAction, 10),
    topAdminActors: topEntriesFromCounter(byAdminActor, 10),
  };
}

exports.getSecurityLogsDailyStats = secureOnCall(
  'getSecurityLogsDailyStats',
  getSecurityLogsDailyStatsHandler
);
exports.getSecurityLogsDailyStatsV2 = wrapV2CallableNamed(
  'getSecurityLogsDailyStats',
  getSecurityLogsDailyStatsHandler
);

async function verifyBearerToken(request) {
  const header = String(request.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    throw new Error('missing-bearer-token');
  }
  const idToken = header.substring(7).trim();
  if (!idToken) {
    throw new Error('invalid-bearer-token');
  }
  return admin.auth().verifyIdToken(idToken, true);
}

async function listAllAuthUsers() {
  const users = [];
  let nextPageToken;
  try {
    do {
      const page = await admin.auth().listUsers(1000, nextPageToken);
      users.push(...page.users);
      nextPageToken = page.pageToken;
    } while (nextPageToken);
  } catch (error) {
    error.__authListFailed = true;
    throw error;
  }
  return users;
}

async function listFirestoreUsersFallback() {
  const snap = await db.collection('users').get();
  const users = [];
  snap.forEach(doc => {
    const data = doc.data() || {};
    const role = String(data.role || '').toLowerCase();
    users.push({
      uid: doc.id,
      email: data.email || '',
      displayName: data.displayName || data.name || '',
      disabled: false,
      customClaims: {
        admin: role === 'admin' || role === 'super_admin',
        role: role || 'user',
      },
      metadata: {
        creationTime: data.createdAt?.toDate?.()?.toISOString?.() || null,
        lastSignInTime: data.lastLogin?.toDate?.()?.toISOString?.() || null,
      },
      __source: 'firestore',
    });
  });
  return users;
}

async function syncUsersCore() {
  let users = [];
  let usingFallback = false;
  try {
    users = await listAllAuthUsers();
  } catch (error) {
    console.warn(
      '[syncUsersToFirestore] Auth listUsers failed, using Firestore fallback:',
      error.message
    );
    users = await listFirestoreUsersFallback();
    usingFallback = true;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  let syncedUsers = 0;
  const newUsers = [];

  for (const user of users) {
    if (!user || !user.uid) continue;
    const ref = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set(
        {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          name: user.displayName || '',
          role: isAdminToken(user.customClaims || {}) ? 'admin' : 'user',
          status: 'active',
          createdAt: now,
          updatedAt: now,
          source: 'syncUsersToFirestore',
        },
        { merge: true }
      );
      syncedUsers += 1;
      newUsers.push({
        uid: user.uid,
        email: user.email || '',
      });
    }
  }

  return {
    success: true,
    syncedUsers,
    newUsers,
    totalAuthUsers: users.length,
    totalFirestoreUsers: users.length - syncedUsers,
    source: usingFallback ? 'firestore-fallback' : 'auth',
  };
}

async function resolveProductForDownload(productId) {
  const candidates = [
    db.collection('announcements').doc(productId),
    db.collection('products').doc(productId),
  ];
  for (const ref of candidates) {
    const snap = await ref.get();
    if (snap.exists) {
      return { id: snap.id, ...snap.data() };
    }
  }
  return null;
}

async function findPurchaseRecord(userId, productId) {
  const subRef = db.collection('users').doc(userId).collection('purchases');
  const direct = await subRef.doc(productId).get();
  if (direct.exists) {
    return {
      ref: direct.ref,
      data: direct.data(),
      source: 'usersSubDoc',
      id: direct.id,
    };
  }

  const byProduct = await subRef.where('productId', '==', productId).limit(1).get();
  if (!byProduct.empty) {
    const doc = byProduct.docs[0];
    return {
      ref: doc.ref,
      data: doc.data(),
      source: 'usersSubQuery',
      id: doc.id,
    };
  }

  const orderByProduct = await db
    .collection('orders')
    .where('userId', '==', userId)
    .where('productId', '==', productId)
    .limit(1)
    .get();
  if (!orderByProduct.empty) {
    const doc = orderByProduct.docs[0];
    return { ref: doc.ref, data: doc.data(), source: 'orders', id: doc.id };
  }

  return null;
}

exports.updateUserLocation = secureOnCall('updateUserLocation', async (_data, context) => {
  const uid = requireAuth(context);
  const req = context.rawRequest || {};
  const ip = getRequestIp(req);
  const userAgent = String(req.headers?.['user-agent'] || '');

  let geo = null;
  if (ip) {
    try {
      const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
      if (response.ok) {
        const json = await response.json();
        if (json && json.success !== false) {
          geo = json;
        }
      }
    } catch (_e) {}
  }

  await getUserRef(uid).set(
    {
      uid,
      email: context.auth?.token?.email || '',
      lastIP: ip || '',
      lastUserAgent: userAgent,
      country: geo?.country || '',
      countryCode: geo?.country_code || '',
      city: geo?.city || '',
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      loginCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { success: true };
});

exports.listAdminUsers = secureOnCall('listAdminUsers', async (_data, context) => {
  await requireAdminOrAllowlist(context);
  let users = [];
  let source = 'auth';
  try {
    users = await listAllAuthUsers();
  } catch (error) {
    console.warn(
      '[listAdminUsers] Auth listUsers failed, using Firestore fallback:',
      error.message
    );
    source = 'firestore-fallback';
    users = await listFirestoreUsersFallback();
  }

  const normalized = users
    .filter(user => user && user.uid)
    .map(user => ({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      disabled: Boolean(user.disabled),
      customClaims: user.customClaims || {},
      metadata: {
        creationTime: user.metadata?.creationTime || null,
        lastSignInTime: user.metadata?.lastSignInTime || null,
      },
    }));
  return { success: true, users: normalized, source };
});

exports.deleteUser = secureOnCall('deleteUser', async (data, context) => {
  const actorUid = await requireAdminOrAllowlist(context);
  const userId = String(data?.userId || '').trim();
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'userId requerido');
  }
  if (userId === actorUid) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No puedes eliminar tu propia cuenta.'
    );
  }

  const targetRef = db.collection('users').doc(userId);
  const targetSnap = await targetRef.get();
  const targetFirestoreData = targetSnap.exists ? targetSnap.data() || {} : {};
  const firestoreRole = String(targetFirestoreData.role || '').toLowerCase();
  const firestoreEmail = String(targetFirestoreData.email || '').toLowerCase();

  // Protección: nunca permitir eliminación de admins por rol Firestore.
  if (firestoreRole === 'admin' || firestoreRole === 'super_admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Usuario administrador protegido.'
    );
  }

  let target = null;
  try {
    target = await admin.auth().getUser(userId);
  } catch (error) {
    const code = String(error?.code || '');
    if (code !== 'auth/user-not-found') {
      throw error;
    }
  }
  const settingsSnap = await db.collection('settings').doc('system-config').get();
  const allowEmailsRaw = settingsSnap.get('security.adminAllowlistEmails') || '';
  const allowUidsRaw = settingsSnap.get('security.adminAllowlistUids') || '';
  const protectedEmails = parseAllowlist(allowEmailsRaw);
  const protectedUids = String(allowUidsRaw)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  const targetUidResolved = String(target?.uid || userId);
  const targetEmail = String(target?.email || firestoreEmail || '').toLowerCase();
  if (
    isAdminToken(target?.customClaims || {}) ||
    protectedUids.includes(targetUidResolved) ||
    (targetEmail && protectedEmails.includes(targetEmail))
  ) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Usuario administrador protegido.'
    );
  }

  if (target?.uid) {
    await admin.auth().deleteUser(target.uid);
    await db.collection('users').doc(target.uid).delete().catch(() => null);
  } else if (targetSnap.exists) {
    await targetRef.delete().catch(() => null);
  } else {
    throw new functions.https.HttpsError('not-found', 'Usuario no encontrado.');
  }

  await writeSecurityAudit({
    type: 'admin_delete_user',
    actorUid,
    actorEmail: String(context.auth?.token?.email || ''),
    targetUid: targetUidResolved,
    targetEmail: target?.email || firestoreEmail || '',
    source: 'httpsCallable:deleteUser',
  });

  return { success: true };
});

exports.getUsersCount = secureOnCall('getUsersCount', async (_data, context) => {
  await requireAdminOrAllowlist(context);
  try {
    const users = await listAllAuthUsers();
    return { success: true, count: users.length, source: 'auth' };
  } catch (error) {
    console.warn(
      '[getUsersCount] Auth listUsers failed, using Firestore fallback:',
      error.message
    );
    const users = await listFirestoreUsersFallback();
    return { success: true, count: users.length, source: 'firestore-fallback' };
  }
});

exports.generateDownloadLink = secureOnCall('generateDownloadLink', async (data, context) => {
  const uid = requireAuth(context);
  const productId = String(data?.productId || '').trim();
  if (!productId) {
    throw new functions.https.HttpsError('invalid-argument', 'productId requerido');
  }

  const product = await resolveProductForDownload(productId);
  if (!product) {
    throw new functions.https.HttpsError('not-found', 'Producto no encontrado.');
  }

  const record = await findPurchaseRecord(uid, productId);
  if (!record) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'No existe una compra válida para este producto.'
    );
  }

  const purchaseData = record.data || {};
  if (
    purchaseData?.downloadAccess?.status === 'revoked' ||
    purchaseData?.revoked === true
  ) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso revocado.');
  }

  const maxDownloads = parsePositiveIntBounded(
    purchaseData.maxDownloads,
    3,
    1,
    20
  );
  const currentCount = parsePositiveIntBounded(
    purchaseData.downloadCount,
    0,
    0,
    100000
  );
  if (currentCount >= maxDownloads) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Has alcanzado el límite de descargas.'
    );
  }

  const purchaseTimestamp =
    purchaseData.purchasedAt?.toMillis?.() ||
    purchaseData.createdAt?.toMillis?.() ||
    purchaseData.timestamp?.toMillis?.() ||
    Date.now();
  const windowHours = parsePositiveIntBounded(
    purchaseData.downloadWindowHours,
    48,
    1,
    24 * 30
  );
  const expiresAtMs = purchaseTimestamp + windowHours * 60 * 60 * 1000;
  if (Date.now() > expiresAtMs) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'El período de descarga ha expirado.'
    );
  }

  const storagePath =
    product.storagePath || product.filePath || product.downloadStoragePath || '';
  const rawUrl = product.downloadUrl || product.fileUrl || product.url || '';
  const fileName =
    product.fileName ||
    product.name ||
    `producto_${productId}.zip`;

  let downloadUrl = String(rawUrl || '').trim();
  if (storagePath) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 5 * 60 * 1000,
      responseDisposition: `attachment; filename="${fileName}"`,
    });
    downloadUrl = signedUrl;
  }

  if (!downloadUrl) {
    throw new functions.https.HttpsError(
      'not-found',
      'Archivo de descarga no configurado.'
    );
  }

  await record.ref.set(
    {
      userId: uid,
      productId,
      downloadCount: currentCount + 1,
      lastDownloadAt: admin.firestore.FieldValue.serverTimestamp(),
      downloadAccess: {
        status: 'active',
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const remainingDownloads = Math.max(maxDownloads - (currentCount + 1), 0);
  return {
    success: true,
    downloadUrl,
    fileName,
    remainingDownloads,
    expiresIn: 300,
  };
});

exports.revokePurchaseAccess = secureOnCall('revokePurchaseAccess', async (data, context) => {
  const actorUid = await requireAdminOrAllowlist(context);
  const purchaseId = String(data?.purchaseId || '').trim();
  const userId = String(data?.userId || '').trim();
  const productId = String(data?.productId || '').trim();

  if (!userId || (!purchaseId && !productId)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'userId y purchaseId/productId requeridos.'
    );
  }

  const updates = {
    'downloadAccess.status': 'revoked',
    'downloadAccess.revocationReason': 'Manual Revocation by Admin',
    'downloadAccess.revokedAt': admin.firestore.FieldValue.serverTimestamp(),
    'downloadAccess.revokedBy': actorUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  let updatedDocs = 0;
  const writeTasks = [];
  if (purchaseId) {
    writeTasks.push(
      db.collection('purchases').doc(purchaseId).set(updates, { merge: true }),
      db
        .collection('orders')
        .doc(purchaseId)
        .set(updates, { merge: true }),
      db
        .collection('users')
        .doc(userId)
        .collection('purchases')
        .doc(purchaseId)
        .set(updates, { merge: true })
    );
  }
  if (productId) {
    writeTasks.push(
      db
        .collection('users')
        .doc(userId)
        .collection('purchases')
        .doc(productId)
        .set(
          {
            ...updates,
            productId,
            userId,
          },
          { merge: true }
        )
    );
  }
  await Promise.all(
    writeTasks.map(async task => {
      await task;
      updatedDocs += 1;
    })
  );

  await writeSecurityAudit({
    type: 'purchase_access_revoked',
    actorUid,
    actorEmail: String(context.auth?.token?.email || ''),
    userId,
    purchaseId: purchaseId || null,
    productId: productId || null,
    source: 'httpsCallable:revokePurchaseAccess',
  });

  return { success: true, updatedDocs };
});

exports.verifyCheckoutSession = secureOnCall('verifyCheckoutSession', async (data, context) => {
  const uid = requireAuth(context);
  const sessionId = String(data?.sessionId || '').trim();
  const productId = String(data?.productId || '').trim();
  if (!sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'sessionId requerido');
  }

  const ordersSnap = await db
    .collection('orders')
    .where('sessionId', '==', sessionId)
    .limit(5)
    .get();
  const orderDoc = ordersSnap.docs.find(doc => {
    const row = doc.data() || {};
    const byOwner = String(row.userId || '') === uid;
    const byProduct = !productId || String(row.productId || '') === productId;
    return byOwner && byProduct;
  });
  if (orderDoc) {
    const row = orderDoc.data() || {};
    return {
      success: true,
      productId: row.productId || productId || '',
      productTitle: row.productTitle || row.name || row.title || 'Producto',
      price: row.price || row.amount || 0,
      orderId: orderDoc.id,
      sessionId,
    };
  }

  const purchaseSnap = await db
    .collection('users')
    .doc(uid)
    .collection('purchases')
    .where('sessionId', '==', sessionId)
    .limit(1)
    .get();
  if (!purchaseSnap.empty) {
    const row = purchaseSnap.docs[0].data() || {};
    return {
      success: true,
      productId: row.productId || productId || purchaseSnap.docs[0].id,
      productTitle: row.productTitle || row.name || row.title || 'Producto',
      price: row.price || row.amount || 0,
      orderId: purchaseSnap.docs[0].id,
      sessionId,
    };
  }

  throw new functions.https.HttpsError(
    'not-found',
    'Sesión de pago no encontrada o no pertenece al usuario.'
  );
});

exports.syncUsersToFirestoreCallable = secureOnCall(
  'syncUsersToFirestoreCallable',
  async (_data, context) => {
  await requireAdminOrAllowlist(context);
  try {
    return await syncUsersCore();
  } catch (error) {
    console.error('[syncUsersToFirestoreCallable] error:', error.message);
    try {
      const users = await listFirestoreUsersFallback();
      return {
        success: true,
        syncedUsers: 0,
        newUsers: [],
        totalAuthUsers: users.length,
        totalFirestoreUsers: users.length,
        source: 'firestore-fallback-error-recovery',
        warning: 'No se pudo sincronizar con Auth; se devolvió estado desde Firestore.',
      };
    } catch (_fallbackError) {
      throw new functions.https.HttpsError(
        'internal',
        'Error interno sincronizando usuarios'
      );
    }
  }
  }
);

exports.syncUsersToFirestore = functions.https.onRequest(async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  if (request.method !== 'POST') {
    response.status(405).json({ success: false, message: 'Método no permitido' });
    return;
  }

  try {
    await assertAppCheckHttp(request, 'syncUsersToFirestore');
    const decoded = await verifyBearerToken(request);
    const allowlisted = await isAllowlistedAdmin(
      String(decoded.uid || ''),
      String(decoded.email || '')
    );
    const roleAdmin = await isFirestoreRoleAdmin(String(decoded.uid || ''));
    if (!isAdminToken(decoded) && !allowlisted && !roleAdmin) {
      response.status(403).json({ success: false, message: 'Permisos insuficientes' });
      return;
    }

    const result = await syncUsersCore();
    response.json(result);
  } catch (error) {
    console.error('[syncUsersToFirestore] error:', error.message);
    const status =
      error.message === 'missing-bearer-token' || error.message === 'invalid-bearer-token'
        ? 401
        : 500;
    if (status === 401) {
      response.status(401).json({
        success: false,
        message: 'Token inválido o ausente',
      });
      return;
    }

    try {
      const users = await listFirestoreUsersFallback();
      response.status(200).json({
        success: true,
        syncedUsers: 0,
        newUsers: [],
        totalAuthUsers: users.length,
        totalFirestoreUsers: users.length,
        source: 'firestore-fallback-error-recovery',
        warning: 'No se pudo sincronizar con Auth; se devolvió estado desde Firestore.',
      });
    } catch (_fallbackError) {
      response.status(500).json({
        success: false,
        message: 'Error interno sincronizando usuarios',
      });
    }
  }
});

function formatUtcDayKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getUtcDayBounds(offsetDays = 0) {
  const now = new Date();
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  day.setUTCDate(day.getUTCDate() + offsetDays);
  const start = day;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function aggregateSecurityLogsForDay(start, end) {
  let query = db
    .collection('security_logs')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))
    .where('createdAt', '<', admin.firestore.Timestamp.fromDate(end))
    .orderBy('createdAt', 'asc')
    .limit(500);

  let lastDoc = null;
  let processed = 0;
  let registrationBlocked = 0;
  let adminActions = 0;
  const byType = {};
  const byReason = {};
  const byAdminAction = {};
  const byAdminActor = {};

  // Paginate to avoid timeout on large log volumes.
  // Hard cap keeps this scheduler deterministic and cheap.
  for (let page = 0; page < 20; page += 1) {
    const snap = await query.get();
    if (snap.empty) break;

    snap.forEach(doc => {
      const row = doc.data() || {};
      const type = String(row.type || 'unknown');
      const reason = String(row.reason || 'none');

      processed += 1;
      byType[type] = (byType[type] || 0) + 1;
      byReason[reason] = (byReason[reason] || 0) + 1;
      if (type === 'registration_blocked') {
        registrationBlocked += 1;
      }
      if (type === 'admin_action') {
        adminActions += 1;
        const action = String(row.action || row.event || 'unknown_action');
        const actorKey = String(
          row.actorUid ||
            row.adminUid ||
            row.actorEmail ||
            row.userId ||
            'unknown_actor'
        );
        byAdminAction[action] = (byAdminAction[action] || 0) + 1;
        byAdminActor[actorKey] = (byAdminActor[actorKey] || 0) + 1;
      }
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    if (!lastDoc) break;
    query = query.startAfter(lastDoc);
  }

  return {
    processed,
    registrationBlocked,
    adminActions,
    byType,
    byReason,
    byAdminAction,
    byAdminActor,
  };
}

exports.aggregateSecurityLogsDaily = functions.pubsub
  .schedule('10 1 * * *')
  .timeZone('Etc/UTC')
  .onRun(async () => {
    const { start, end } = getUtcDayBounds(-1);
    const dayKey = formatUtcDayKey(start);
    const aggregated = await aggregateSecurityLogsForDay(start, end);

    await db
      .collection('security_logs_daily')
      .doc(dayKey)
      .set(
        {
          dateKey: dayKey,
          dayStart: admin.firestore.Timestamp.fromDate(start),
          dayEnd: admin.firestore.Timestamp.fromDate(end),
          totals: {
            logs: aggregated.processed,
            registrationBlocked: aggregated.registrationBlocked,
            adminActions: aggregated.adminActions,
          },
          byType: aggregated.byType,
          byReason: aggregated.byReason,
          byAdminAction: aggregated.byAdminAction,
          byAdminActor: aggregated.byAdminActor,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          source: 'aggregateSecurityLogsDaily',
          version: 2,
        },
        { merge: true }
      );

    console.info(
      `[aggregateSecurityLogsDaily] ${dayKey} logs=${aggregated.processed}`
    );
    return null;
  });

const LOG_RETENTION_DAYS = 30;
const NON_CRITICAL_LOG_TYPES = new Set([
  'registration_blocked',
  'registration_allowed',
  'admin_view_open',
  'admin_action',
  'analytics_event',
]);

function isLogEligibleForCleanup(row) {
  const type = String(row?.type || 'unknown');
  const critical = row?.critical === true || row?.severity === 'critical';
  if (critical) return false;
  return NON_CRITICAL_LOG_TYPES.has(type);
}

exports.cleanupSecurityLogsRetention = functions.pubsub
  .schedule('40 1 * * *')
  .timeZone('Etc/UTC')
  .onRun(async () => {
    const cutoffDate = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const cutoff = admin.firestore.Timestamp.fromDate(cutoffDate);

    let deleted = 0;
    let scanned = 0;

    // Batch loop with strict cap to keep execution bounded.
    for (let i = 0; i < 8; i += 1) {
      const snap = await db
        .collection('security_logs')
        .where('createdAt', '<', cutoff)
        .orderBy('createdAt', 'asc')
        .limit(200)
        .get();

      if (snap.empty) break;
      const batch = db.batch();
      let deletionsInBatch = 0;

      snap.forEach(doc => {
        scanned += 1;
        const row = doc.data() || {};
        if (!isLogEligibleForCleanup(row)) return;
        batch.delete(doc.ref);
        deletionsInBatch += 1;
      });

      if (!deletionsInBatch) break;
      await batch.commit();
      deleted += deletionsInBatch;
    }

    console.info(
      `[cleanupSecurityLogsRetention] cutoff=${cutoffDate.toISOString()} scanned=${scanned} deleted=${deleted}`
    );
    return null;
  });

// System settings endpoints moved to functions-admin codebase to avoid conflicts.

