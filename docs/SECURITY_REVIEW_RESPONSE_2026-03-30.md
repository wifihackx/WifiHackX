# Security Review Response

> Estado documental: soporte de auditoria. No tratar este archivo como lista canonica de pendientes sin contrastarlo con `PENDING_TASKS.md`.

Fecha: 2026-03-30

## Analisis revisado

Se revisaron 7 puntos reportados como vulnerabilidades abiertas.

## Clasificacion final

### 1. App Check sin integracion funcional

Clasificacion:

- parcial

Estado real:

- App Check esta integrado en frontend y backend
- ya no debe tratarse como "sin integracion"
- si vuelve a fallar un debug token local o un exchange puntual, eso es un problema operativo, no evidencia de ausencia total de proteccion

Referencias:

- [app-check-init.js](C:\Users\Internet\Desktop\WifiHackX\public\js\app-check-init.js)
- [security.js](C:\Users\Internet\Desktop\WifiHackX\functions\lib\security.js)
- [SECURITY_STATUS.md](C:\Users\Internet\Desktop\WifiHackX\docs\SECURITY_STATUS.md)

Accion tomada:

- mantenerlo como punto de vigilancia operativa
- no marcarlo como vulnerabilidad abierta sin verificar enforcement real

### 2. Catalogo publico con query Firestore abierta

Clasificacion:

- falso / ya corregido

Estado real:

- el frontend publico ya no consulta Firestore directamente
- usa snapshot backend
- el fallback directo a Firestore esta deshabilitado
- las reglas niegan lectura publica de `announcements`

Referencias:

- [announcement-system.js](C:\Users\Internet\Desktop\WifiHackX\src\js\announcement-system.js)
- [index.js](C:\Users\Internet\Desktop\WifiHackX\functions\index.js)
- [firestore.rules](C:\Users\Internet\Desktop\WifiHackX\firestore.rules)

### 3. Auth sin CAPTCHA visible

Clasificacion:

- falso para produccion

Estado real:

- el registro fuera de localhost exige token reCAPTCHA
- el bypass local ya no esta activo por defecto

Referencias:

- [auth.js](C:\Users\Internet\Desktop\WifiHackX\src\js\auth.js)
- [index.js](C:\Users\Internet\Desktop\WifiHackX\src\js\modules\auth\index.js)
- [local-dev-recaptcha-policy.js](C:\Users\Internet\Desktop\WifiHackX\src\js\modules\auth\local-dev-recaptcha-policy.js)

### 4. Sin Budget Alerts en GCP

Clasificacion:

- cierto y pendiente

Estado real:

- no es un bug de codigo
- es una tarea operativa fuera del repo

Accion recomendada:

- crear Budget Alert en GCP Billing

### 5. Preload WebP en cada request

Clasificacion:

- cierto como coste potencial

Estado real:

- no era una vulnerabilidad critica
- si podia aumentar bandwidth innecesario

Accion tomada:

- eliminado el preload global del hero
- se mantiene priorizacion en la propia imagen con `fetchpriority=\"high\"` y `loading=\"eager\"`

Referencias:

- [index.html](C:\Users\Internet\Desktop\WifiHackX\index.html)
- [validate-dist.js](C:\Users\Internet\Desktop\WifiHackX\tools\validate-dist.js)
- [validate-sprint5.js](C:\Users\Internet\Desktop\WifiHackX\tools\validate-sprint5.js)

### 6. Preconnects de Stripe expuestos

Clasificacion:

- falso / ya corregido

Estado real:

- los preconnects de Stripe ya no estan en el camino critico del HTML principal
- Stripe se prepara de forma lazy

Referencias:

- [index.html](C:\Users\Internet\Desktop\WifiHackX\index.html)
- [stripe-loader.js](C:\Users\Internet\Desktop\WifiHackX\src\js\stripe-loader.js)

### 7. Sentry eliminado

Clasificacion:

- falso

Estado real:

- Sentry sigue presente en el codigo
- no hay evidencia de eliminacion completa de monitorizacion

Referencias:

- [sentry-init.js](C:\Users\Internet\Desktop\WifiHackX\public\js\sentry-init.js)
- [index.js](C:\Users\Internet\Desktop\WifiHackX\src\js\modules\features\index.js)
- [logger-unified.js](C:\Users\Internet\Desktop\WifiHackX\src\js\logger-unified.js)

## Pendientes reales tras esta revision

1. Crear Budget Alerts en GCP Console.
2. Seguir vigilando App Check como control operativo real.
3. Mantener Stripe en `pk_test` hasta terminar pruebas.
4. Hacer cutover a `pk_live` y `sk_live` cuando acaben las pruebas.

## Estado actual del hardening frontend

Ademas de la clasificacion anterior, el repo ya incorpora hardening especifico contra patrones repetidos de frontend:

- `innerHTML` con datos variables sin escape
- atributos `data-*`, `href`, `src`, `alt` y `title` interpolados sin saneado
- selectores CSS construidos con ids o `data-*` variables
- URLs tomadas del DOM, backend o almacenamiento local sin validacion previa
- mensajes de error crudos reutilizados en UI

Este endurecimiento ya no depende solo de revision manual. Hay cobertura automatica en:

- `npm run security:scan`
- `npm run security:scan:frontend`

Referencias:

- [audit-frontend-dom-safety.mjs](C:\Users\Internet\Desktop\WifiHackX\tools\audit-frontend-dom-safety.mjs)
- [frontend-dom-safety-baseline.json](C:\Users\Internet\Desktop\WifiHackX\tools\frontend-dom-safety-baseline.json)
- [security-scan.yml](C:\Users\Internet\Desktop\WifiHackX\.github\workflows\security-scan.yml)
- [quality-gates.yml](C:\Users\Internet\Desktop\WifiHackX\.github\workflows\quality-gates.yml)
- [ci-release.yml](C:\Users\Internet\Desktop\WifiHackX\.github\workflows\ci-release.yml)

## Que protege ya CI

En el estado actual, CI bloquea regresiones en estas categorias:

- escaneo de secretos y artefactos que parecen credenciales
- auditoria DOM/frontend para selectores dinamicos, atributos HTML interpolados y `innerHTML` con template literals
- validacion de origenes externos permitidos

Esto reduce bastante el riesgo de que reaparezcan silenciosamente las clases de fallo ya corregidas durante esta ronda.

## Que sigue fuera de CI

Siguen siendo tareas operativas o de revision contextual:

- configuracion de Budget Alerts en GCP
- enforcement real de App Check en entornos y flujos concretos
- decisiones de cutover Stripe `test` -> `live`
- cualquier cambio futuro que sea seguro pero requiera actualizar la baseline manualmente

## Resultado

De los 7 puntos analizados:

- ciertos y pendientes: 2
- parciales / requieren contexto operativo: 1
- falsos o ya corregidos: 4
