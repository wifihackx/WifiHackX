# Key Rotation Runbook

## Objetivo

Rotar credenciales expuestas en historial/config y dejar el entorno limpio para pruebas y producción.

## Inventario actual (frontend)

Archivo: `index.html`

1. `firebase.apiKey`

- Valor actual: `AIza...` (web API key pública, restringir por referrer)
- Acción: regenerar/restringir en Google Cloud Console.

2. `payments.stripePublicKey`

- Valor actual: `REPLACE_WITH_STRIPE_PUBLISHABLE_KEY`
- Acción: usar `pk_test_...` en test o `pk_live_...` en producción.

3. `payments.paypalClientId`

- Valor actual: presente en runtime config.
- Acción: opcional rotación (es pública), obligatoria si hubo exposición fuera de repo.

4. `appCheck.siteKey` y `recaptcha.siteKey`

- Son claves públicas (no secret), no críticas por exposición.
- Acción: mantener con dominios permitidos correctos.

## Inventario backend (rotación obligatoria si hubo fuga)

1. Stripe secret key (`sk_test_...` / `sk_live_...`)
2. Stripe webhook secret (`whsec_...`)
3. reCAPTCHA secret key (server-side verify)
4. Firebase service account keys JSON (si existen descargadas/exportadas)
5. Cualquier token/secret en GitHub Actions / Firebase Functions params

## Orden recomendado de rotación

1. Crear nuevas claves backend (Stripe + reCAPTCHA secret).
2. Actualizar secrets en Firebase Functions/GitHub.
3. Deploy backend (`firebase deploy --only functions`).
4. Cambiar claves frontend (`index.html` runtime config).
5. Deploy hosting (`firebase deploy --only hosting`).
6. Revocar claves antiguas.

## Verificación mínima

```powershell
npm run build --silent
npm run security:scan
```

Resultado esperado:

- `critical=0`
- `warning=0` o solo `Google API key` controlada/restringida.

## Nota de riesgo

- `firebase.apiKey` y `paypalClientId` son públicas por diseño, pero igual deben estar restringidas por referrer/dominios para evitar abuso.
