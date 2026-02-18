/**
 * log-sanitizer.js
 * Intercepta y sanitiza los logs de consola para proteger datos sensibles
 * como emails, claves de API y tokens.
 *
 * Debe cargarse LO ANTES POSIBLE en el head.
 */

(function () {
  'use strict';

  // Guardar referencias originales
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  // Patrones a redactar
  const REDACTION_PATTERNS = [
    // Emails
    {
      regex: /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g,
      replacement: '[EMAIL PROTECTED]',
    },
    // Stripe Public Keys (solo por si acaso, aunque son públicas)
    {
      regex: /pk_test_[a-zA-Z0-9]{24,}/g,
      replacement: 'pk_test_***',
    },
    // Stripe Private Keys (CRITICO)
    {
      regex: /sk_test_[a-zA-Z0-9]{24,}/g,
      replacement: 'sk_test_***',
    },
    // PayPal Client IDs (general pattern if identifiable, usually long strings in URLs)
    // Redactar cualquier cosa que parezca un token largo en logs de updateUserInterface

    // Firebase UID (28 chars alphanumeric)
    {
      regex: /\b[a-zA-Z0-9]{28}\b/g,
      replacement: '[UID REDACTED]',
    },
    // Sensitive URL parameters (apiKey=..., token=..., secret=...)
    {
      regex: /(apiKey|token|secret|key|auth)=[^&"'\s]+/gi,
      replacement: '$1=[REDACTED]',
    },
  ];

  /**
   * Sanitiza un argumento individual
   */
  function sanitizeArg(arg) {
    if (typeof arg === 'string') {
      let sanitized = arg;
      REDACTION_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern.regex, pattern.replacement);
      });
      return sanitized;
    }

    if (typeof arg === 'object' && arg !== null) {
      try {
        // Hacer una copia superficial para no modificar el objeto original si es usado por la app
        // Sin embargo, deep clone es costoso. Para logs, stringify suele ser lo que se ve.
        // Si es un objeto complejo, intentamos sanitizar sus valores string más comunes
        // Nota: Modificar objetos en logs puede ser engañoso, pero estamos protegiendo datos.

        // Estrategia: Si es un objeto simple, iterar claves
        if (Array.isArray(arg)) {
          return arg.map(item => sanitizeArg(item));
        }

        // No modificar el objeto original, devolver una representación sanitizada si encontramos datos sensibles
        // O simplemente dejarlo pasar si clonar es muy costoso, pero verificar strings
        // Para este script simple, nos enfocamos en strings. Si el objeto tiene email, se verá al expandir.
        // Una opción es interceptar el output stringificado, pero console.log es vivo.

        // Intento básico de sanitizar propiedades de primer nivel comunes
        const sensitiveKeys = [
          'email',
          'password',
          'token',
          'apiKey',
          'secret',
          'key',
        ];
        let modified = false;
        let clone = null;

        for (const key in arg) {
          if (Object.prototype.hasOwnProperty.call(arg, key)) {
            if (
              sensitiveKeys.includes(key.toLowerCase()) &&
              typeof arg[key] === 'string'
            ) {
              if (!clone)
                clone = {
                  ...arg,
                }; // Clone on write
              clone[key] = '[REDACTED]';
              modified = true;
            }
          }
        }
        return modified ? clone : arg;
      } catch (_e) {
        return arg;
      }
    }

    return arg;
  }

  /**
   * Crea un wrapper para las funciones de consola
   */
  function createWrapper(originalFunc) {
    return function (...args) {
      const sanitizedArgs = args.map(arg => sanitizeArg(arg));
      originalFunc.apply(console, sanitizedArgs);
    };
  }

  // Sobrescribir funciones
  // console.log = createWrapper(originalLog);
  // console.warn = createWrapper(originalWarn);
  // console.error = createWrapper(originalError);
  // console.info = createWrapper(originalInfo);

  // NOTA: Sobrescribir console.log puede romper sourcemaps o causar problemas de depuración en algunos navegadores.
  // Usaremos una técnica menos invasiva para el log específico de updateUserInterface y emails si es posible,
  // o aplicaremos globalmente solo si se confirma que es seguro.
  // Dado que el usuario pidió explícitamente "que no salgan datos", la sobrescritura es la garantía.

  // Habilitar protección
  const hostname = window.location && window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1';

  // Silenciar logs verbosos para limpieza total (mantener WARN/ERROR)
  console.log = () => {};
  console.info = () => {};
  console.warn = createWrapper(originalWarn);
  console.error = createWrapper(originalError);
})();
