import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const readFile = file => fs.readFileSync(path.join(root, file), 'utf8');

const errors = [];
const warnings = [];
const args = new Set(process.argv.slice(2));
const requireStripeKey =
  args.has('--require-stripe-key') ||
  /^(1|true|yes)$/i.test(String(process.env.WFX_REQUIRE_STRIPE_PUBLIC_KEY || ''));

const pass = msg => console.log(`[PASS] ${msg}`);
const fail = msg => {
  errors.push(msg);
  console.error(`[FAIL] ${msg}`);
};
const warn = msg => {
  warnings.push(msg);
  console.warn(`[WARN] ${msg}`);
};

const indexHtml = readFile('index.html');
const publicRuntimeConfig = JSON.parse(readFile('public/config/runtime-config.json'));
const firebaseJson = JSON.parse(readFile('firebase.json'));

function extractRuntimeConfig(html) {
  const match = html.match(
    /<script(?=[^>]*\bid=["']runtime-config["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>\s*([\s\S]*?)\s*<\/script>/i
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (_error) {
    return null;
  }
}

function extractSchemaGraph(html) {
  const match = html.match(
    /<script type="application\/ld\+json" id="schema-organization">\s*([\s\S]*?)\s*<\/script>/i
  );
  if (!match) return null;
  try {
    const payload = JSON.parse(match[1]);
    return Array.isArray(payload) ? payload : payload['@graph'];
  } catch (_error) {
    return null;
  }
}

function validateRuntimeConfig() {
  const inlineRuntimeConfig = extractRuntimeConfig(indexHtml);
  if (!inlineRuntimeConfig) {
    fail('No se pudo parsear #runtime-config en index.html');
    return;
  }
  pass('runtime-config inline parseado correctamente.');

  const runtimeConfig = publicRuntimeConfig || inlineRuntimeConfig;

  const senderId = runtimeConfig?.firebase?.messagingSenderId;
  if (!senderId) {
    warn('firebase.messagingSenderId ausente en runtime-config activo.');
  } else if (!/^\d+$/.test(String(senderId || ''))) {
    fail('firebase.messagingSenderId debe ser entero en string (sin notación científica).');
  } else {
    pass('firebase.messagingSenderId válido.');
  }

  const appId = String(runtimeConfig?.firebase?.appId || '');
  if (!appId) {
    warn('firebase.appId ausente en runtime-config activo.');
  } else if (!/^1:\d+:web:[a-zA-Z0-9]+$/.test(appId)) {
    fail('firebase.appId tiene formato inválido (esperado 1:<digits>:web:<id>).');
  } else {
    pass('firebase.appId válido.');
  }

  const supportEmail = String(runtimeConfig?.support?.email || '').trim();
  if (!supportEmail) {
    fail('support.email vacío en runtime-config.');
  } else if (/@gmail\.com$/i.test(supportEmail)) {
    warn('support.email usa gmail.com; se recomienda dominio corporativo.');
  } else {
    pass('support.email no personal.');
  }

  const stripeKey = String(runtimeConfig?.payments?.stripePublicKey || '').trim();
  if (!stripeKey) {
    if (requireStripeKey) {
      fail('payments.stripePublicKey vacío en modo estricto de producción.');
    } else {
      warn('payments.stripePublicKey vacío (esperado si Stripe no está habilitado aún).');
    }
  } else if (!/^pk_(test|live)_[a-zA-Z0-9]+$/.test(stripeKey)) {
    fail('payments.stripePublicKey tiene formato inválido.');
  } else if (requireStripeKey && !/^pk_live_[a-zA-Z0-9]+$/.test(stripeKey)) {
    fail('payments.stripePublicKey debe ser pk_live_* en modo estricto de producción.');
  } else {
    pass('payments.stripePublicKey con formato válido.');
  }
}

function validateIndexQuality() {
  if (/<meta\s+name="keywords"/i.test(indexHtml)) {
    fail('index.html contiene meta keywords (obsoleto).');
  } else {
    pass('meta keywords no presente en index.html.');
  }

  if (/og:image:secure_url/i.test(indexHtml)) {
    fail('index.html contiene og:image:secure_url (redundante).');
  } else {
    pass('og:image:secure_url no presente en index.html.');
  }

  if (/id="cartTotalValue">\$0\.00</i.test(indexHtml)) {
    fail('cartTotalValue inicia en USD ($0.00) y debe estar en EUR.');
  } else if (/id="cartTotalValue">€0\.00</i.test(indexHtml)) {
    pass('cartTotalValue inicia en EUR.');
  } else {
    warn('No se pudo validar el valor inicial de cartTotalValue.');
  }

  const graph = extractSchemaGraph(indexHtml);
  if (!graph) {
    fail('No se pudo parsear schema-organization.');
    return;
  }

  const hasFaqPage = graph.some(node => node && node['@type'] === 'FAQPage');
  if (hasFaqPage) {
    fail('schema-organization en index incluye FAQPage (debe vivir en faq.html).');
  } else {
    pass('index no incluye FAQPage en schema.');
  }
}

function validateFirebaseHeaders() {
  const headers = firebaseJson?.hosting?.headers || [];
  const wildcard = headers.find(h => h && h.source === '**');
  if (!wildcard || !Array.isArray(wildcard.headers)) {
    fail('No se encontró bloque de headers globales (source "**") en firebase.json.');
    return;
  }

  const csp = wildcard.headers.find(h => h.key === 'Content-Security-Policy');
  if (!csp || !csp.value) {
    fail('Falta Content-Security-Policy en firebase.json.');
    return;
  }

  if (!/frame-src[^;]*https:\/\/www\.googletagmanager\.com/i.test(csp.value)) {
    fail('CSP frame-src no permite https://www.googletagmanager.com (rompe GTM noscript).');
  } else {
    pass('CSP frame-src incluye GTM.');
  }

  if (!/frame-ancestors\s+'none'/i.test(csp.value)) {
    warn("CSP no contiene frame-ancestors 'none'.");
  } else {
    pass('CSP frame-ancestors endurecido.');
  }
}

function main() {
  console.log('== Public Config Hardening Validation ==');
  if (requireStripeKey) {
    console.log('[INFO] Modo estricto: requiere Stripe public key de producción (pk_live_*).');
  }
  validateRuntimeConfig();
  validateIndexQuality();
  validateFirebaseHeaders();

  console.log('');
  console.log(`Resumen: ${errors.length} error(es), ${warnings.length} warning(s).`);
  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
