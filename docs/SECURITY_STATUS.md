# Security Status

## Fecha

2026-02-19

## Resultado actual

- `npm run security:scan` -> `critical=0`, `warning=1`.
- Warning restante: Firebase Web API key en `index.html`.

## Decisión tomada (recomendada)

- Mantener la Firebase Web API key en frontend.
- Esta clave es pública por diseño en apps web Firebase.
- Seguridad real aplicada por controles de plataforma:
  1. Restricciones por HTTP referrer en Google Cloud Console.
  2. App Check en `Enforce` para Auth y Firestore.
  3. Enforzamiento App Check en Cloud Functions por código (wrappers seguros).

## Estado de protecciones

1. Auth App Check: Enforce.
2. Firestore App Check: Enforce.
3. Functions App Check: Enforce en backend (safe mode).
4. Rotación de secretos backend completada (Stripe/reCAPTCHA) y validada.

## Riesgo residual

- Bajo, condicionado a mantener:
  1. referrers de API key correctamente restringidos,
  2. rotación periódica de secretos backend,
  3. monitoreo de errores App Check en consola.

## Acción opcional futura

- Rotar Firebase Browser API key (no obligatorio) para cerrar ciclo de higiene.
