import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));

const configPath = path.join(root, 'public', 'config', 'runtime-config.json');
const functionsPath = path.join(root, 'functions', 'index.js');

const runtimeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const functionsSource = fs.existsSync(functionsPath) ? fs.readFileSync(functionsPath, 'utf8') : '';

const strict = args.has('--strict');
const projectId =
  process.env.WFX_FIREBASE_PROJECT ||
  runtimeConfig?.firebase?.projectId ||
  'white-caster-466401-g0';

const errors = [];
const warnings = [];

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  errors.push(message);
  console.error(`[FAIL] ${message}`);
}

function readJsonCommand(command, commandArgs) {
  const output =
    process.platform === 'win32'
      ? execFileSync('cmd.exe', ['/d', '/s', '/c', `${command}.cmd ${commandArgs.join(' ')}`], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      : execFileSync(command, commandArgs, {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
  return JSON.parse(output);
}

function getFirebaseLogin() {
  const login = readJsonCommand('npx', ['firebase-tools', 'login:list', '--json']);
  const result = Array.isArray(login?.result) ? login.result : [];
  if (!result.length) {
    throw new Error('No hay sesion activa de Firebase CLI en esta maquina.');
  }
  const first = result[0];
  const accessToken = first?.tokens?.access_token || '';
  if (!accessToken) {
    throw new Error('No se pudo obtener access_token desde Firebase CLI.');
  }
  return {
    accessToken,
    email: first?.user?.email || '',
  };
}

function getAccessToken() {
  const envToken = String(
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN ||
      process.env.GCP_ACCESS_TOKEN ||
      process.env.ACCESS_TOKEN ||
      ''
  ).trim();
  if (envToken) {
    return {
      accessToken: envToken,
      source: 'env',
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    };
  }

  const login = getFirebaseLogin();
  return {
    accessToken: login.accessToken,
    source: 'firebase-cli',
    email: login.email,
  };
}

async function fetchJson(url, accessToken, quotaProject) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-goog-user-project': String(quotaProject),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText} ${url}\n${text}`.trim());
  }

  return response.json();
}

function normalizeHostPattern(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function includesAll(actualValues, expectedValues) {
  const actual = new Set(actualValues.map(normalizeHostPattern));
  return expectedValues.every(value => actual.has(normalizeHostPattern(value)));
}

function hasUnexpectedValues(actualValues, allowedValues) {
  const allowed = new Set(allowedValues.map(normalizeHostPattern));
  return actualValues.filter(value => !allowed.has(normalizeHostPattern(value)));
}

async function main() {
  console.log('== Console Security Audit ==');
  console.log(`[INFO] Proyecto: ${projectId}`);

  const auth = getAccessToken();
  pass(`Credenciales disponibles via ${auth.source}${auth.email ? ` (${auth.email})` : ''}`);

  const project = await fetchJson(
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}`,
    auth.accessToken,
    projectId
  );

  const projectNumber = String(project.projectNumber || '').trim();
  if (!projectNumber) {
    throw new Error(`El proyecto ${projectId} no expone projectNumber.`);
  }
  pass(`projectNumber resuelto: ${projectNumber}`);

  const runtimeAppId = String(runtimeConfig?.firebase?.appId || '').trim();
  if (!runtimeAppId) {
    throw new Error('runtime-config no contiene firebase.appId.');
  }
  const app = await fetchJson(
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${encodeURIComponent(
      runtimeAppId
    )}`,
    auth.accessToken,
    projectNumber
  );
  if (!app) {
    throw new Error(`No se encontro ninguna web app para ${projectId}.`);
  }
  pass(`Web app resuelta: ${app.displayName || app.appId}`);

  const accessToken = auth.accessToken;
  const services = await fetchJson(
    `https://firebaseappcheck.googleapis.com/v1/projects/${projectNumber}/services`,
    accessToken,
    projectNumber
  );
  const recaptcha = await fetchJson(
    `https://firebaseappcheck.googleapis.com/v1/projects/${projectNumber}/apps/${encodeURIComponent(
      app.appId
    )}/recaptchaV3Config`,
    accessToken,
    projectNumber
  );
  const debugTokens = await fetchJson(
    `https://firebaseappcheck.googleapis.com/v1/projects/${projectNumber}/apps/${encodeURIComponent(
      app.appId
    )}/debugTokens`,
    accessToken,
    projectNumber
  );
  const apiKey = await fetchJson(
    `https://apikeys.googleapis.com/v2/projects/${projectNumber}/locations/global/keys/${app.apiKeyId}`,
    accessToken,
    projectNumber
  );

  const serviceModes = new Map(
    (services.services || []).map(item => [
      String(item.name || '')
        .split('/')
        .pop(),
      item.enforcementMode,
    ])
  );
  const requiredEnforcedServices = ['identitytoolkit.googleapis.com', 'firestore.googleapis.com'];
  for (const service of requiredEnforcedServices) {
    const mode = serviceModes.get(service);
    if (mode === 'ENFORCED') {
      pass(`App Check en ENFORCED para ${service}`);
    } else {
      fail(`App Check no esta ENFORCED para ${service} (actual: ${mode || 'desconocido'})`);
    }
  }

  if (recaptcha.siteSecretSet === true) {
    pass('App Check reCAPTCHA v3 tiene siteSecret configurado');
  } else {
    fail('App Check reCAPTCHA v3 no tiene siteSecret configurado');
  }

  const tokenTtl = String(recaptcha.tokenTtl || '');
  if (tokenTtl === '3600s') {
    pass('App Check tokenTtl mantiene el valor esperado (3600s)');
  } else {
    warn(`App Check tokenTtl inesperado: ${tokenTtl || 'vacio'}`);
  }

  const minValidScore = Number(recaptcha.minValidScore);
  if (Number.isFinite(minValidScore) && minValidScore >= 0.5) {
    pass(`App Check minValidScore aceptable (${minValidScore})`);
  } else {
    warn(`App Check minValidScore bajo o invalido (${String(recaptcha.minValidScore || '')})`);
  }

  const debugTokenList = Array.isArray(debugTokens.debugTokens) ? debugTokens.debugTokens : [];
  const ciTokens = debugTokenList.filter(
    item => String(item.displayName || '') === 'github-actions-ci'
  );
  if (ciTokens.length === 1 && debugTokenList.length === 1) {
    pass('Solo existe un debug token de App Check y es el dedicado a CI');
  } else {
    fail(
      `Debug tokens de App Check fuera de politica. Total=${debugTokenList.length}, github-actions-ci=${ciTokens.length}`
    );
  }

  const allowedReferrers =
    apiKey?.restrictions?.browserKeyRestrictions?.allowedReferrers?.map(String) || [];
  const requiredReferrers = [
    'https://wifihackx.com/*',
    'https://www.wifihackx.com/*',
    'https://white-caster-466401-g0.firebaseapp.com/*',
    'https://white-caster-466401-g0.web.app/*',
    'http://127.0.0.1:5173/*',
    'http://localhost:5173/*',
  ];
  if (includesAll(allowedReferrers, requiredReferrers)) {
    pass('La API key web incluye los referrers requeridos');
  } else {
    fail('La API key web no incluye todos los referrers requeridos');
  }

  const broadReferrerPatterns = allowedReferrers.filter(
    value =>
      value.includes('localhost:*') ||
      value.includes('127.0.0.1:*') ||
      value.endsWith('localhost/*') ||
      value.endsWith('127.0.0.1/*')
  );
  if (broadReferrerPatterns.length > 0) {
    warn(
      `La API key web sigue permitiendo patrones locales amplios: ${broadReferrerPatterns.join(', ')}`
    );
  } else {
    pass('La API key web no tiene comodines locales amplios');
  }

  const apiTargets = (apiKey?.restrictions?.apiTargets || []).map(item =>
    String(item.service || '')
  );
  const recommendedApiTargets = [
    'firebaseappcheck.googleapis.com',
    'firebaseinstallations.googleapis.com',
    'firebasestorage.googleapis.com',
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
  ];
  if (includesAll(apiTargets, recommendedApiTargets)) {
    pass('La API key web incluye los servicios minimos requeridos');
  } else {
    fail('La API key web no incluye todos los servicios minimos requeridos');
  }

  const extraTargets = hasUnexpectedValues(apiTargets, recommendedApiTargets);
  if (extraTargets.length > 0) {
    warn(`La API key web sigue permitiendo APIs extra: ${extraTargets.join(', ')}`);
  } else {
    pass('La API key web no expone APIs extra fuera del set recomendado');
  }

  const functionsEnforceSignals = [
    'function shouldEnforceAppCheck()',
    'function assertAppCheckHttp(',
    'function secureOnCall(',
  ];
  const missingSignals = functionsEnforceSignals.filter(
    signal => !functionsSource.includes(signal)
  );
  if (missingSignals.length === 0) {
    pass('El backend contiene guardas App Check para Functions');
  } else {
    fail(`Faltan guardas App Check esperadas en functions/index.js: ${missingSignals.join(', ')}`);
  }

  console.log('');
  console.log(`Resumen: ${errors.length} error(es), ${warnings.length} warning(s).`);
  if (warnings.length > 0) {
    console.log('[INFO] Ejecuta con --strict para fallar tambien por warnings.');
  }

  if (errors.length > 0 || (strict && warnings.length > 0)) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`[FAIL] ${error.message || error}`);
  process.exit(1);
});
