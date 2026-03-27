# Security Fix Report

Fecha: 2026-03-27

## Estado final

No se reproduce la vulnerabilidad original para usuarios normales.

Verificación confirmada:

- `firestoreWriteBlocked: true`
- `generateDownloadLinkBlocked: true`
- `recordOrderFromCheckoutBlocked: true`
- `adminClaim: false` en la cuenta usada para la prueba

## Hallazgos reales

### 1. Estado local de compras compartido entre cuentas

Impacto:

- Una compra realizada con una cuenta podía mostrarse como "compra finalizada" al iniciar sesión con otra cuenta en el mismo navegador.

Causa:

- El frontend guardaba compras locales y metadatos de descarga en `localStorage` con claves globales (`wfx_local_purchases`, `wfx_download_*`, `wfx_last_download_*`) sin aislar por `uid`.

Corrección:

- Se aisló el estado local por usuario autenticado.

Archivos:

- `src/js/post-checkout-handler.js`
- `src/js/ultimate-download-manager.js`
- `src/js/announcement-system.js`
- espejos equivalentes en `public/js`

### 2. Marcado local prematuro de compra completada

Impacto:

- Una URL de retorno o un flujo interrumpido podía dejar la UI en estado de compra completada antes de que el servidor confirmara la persistencia útil.

Causa:

- El post-checkout aplicaba estado local de compra demasiado pronto.

Corrección:

- El estado local de compra se aplica solo después de obtener confirmación útil del servidor.

Archivos:

- `src/js/post-checkout-handler.js`
- espejo en `public/js`

### 3. Condición de carrera de PayPal al limpiar el carrito

Impacto:

- El SDK de PayPal intentaba renderizar un botón sobre un contenedor ya eliminado durante el post-checkout, generando ruido y errores falsos en consola.

Corrección:

- El render de PayPal ahora tolera la desaparición del contenedor como cancelación normal de UI.

Archivos:

- `src/js/paypal-checkout.js`
- espejo en `public/js`

### 4. Borrado incompleto de compras desde admin

Impacto:

- Al eliminar compras canónicas desde admin podían quedar `orders` relacionados, contaminando métricas y listados.

Corrección:

- Se añadió borrado en cascada de `orders` vinculados por `sessionId`, `paypalOrderId` o `userId + productId`.

Archivos:

- `src/js/purchases-list-modal.js`
- `src/js/admin-audit-renderer.js`
- espejos equivalentes en `public/js`

### 5. KPIs stale en el dashboard admin

Impacto:

- El panel podía conservar compras/ingresos antiguos aunque las fuentes reales ya estuvieran vacías.

Corrección:

- Se eliminó la retención indebida de métricas stale.
- Se endureció la resolución de métricas en tiempo real para no reinyectar valores obsoletos sin evidencia actual del servidor.

Archivos:

- `src/js/admin-dashboard-data.js`
- espejo en `public/js`

### 6. Falta de `collectionGroup` en el shim modular para depuración

Impacto:

- Dificultaba validar desde consola el estado real de las compras canónicas.

Corrección:

- Se expuso `collectionGroup` en el shim modular.

Archivos:

- `src/js/firebase-init-modular.js`
- espejo en `public/js`

## Limpieza técnica realizada

- Eliminada función muerta `_isSamePurchaseAttempt`.
- Eliminados helpers/propiedades no usados en `ultimate-download-manager`.
- Actualizados comentarios obsoletos (`ACTUALIZADO`, `REVERTIDO`) para que reflejen el comportamiento real.
- Validación pasada con `npm run lint`.

## Resultado operativo final

Estado confirmado tras limpieza y revalidación del panel admin:

- `orders: 0`
- `revenue: 0`
- `rawRevenue: 0`
- `metricsSource: "orders"`

También se verificó:

- `orders` vacío
- `collectionGroup('purchases')` vacío
- `users.purchases` / `purchaseMeta` vacíos en la inspección realizada

## Nota sobre `implementation_plan.md`

El archivo `implementation_plan.md` contiene una narrativa de vulnerabilidad inicial y propuestas que no representan el estado final validado tras las pruebas manuales y los cambios aplicados. Debe tratarse como documento histórico, no como fuente actual de verdad.
