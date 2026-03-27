# Pending Tasks

Este archivo recoge la deuda técnica y tareas pendientes detectadas tras el cierre del bloque de seguridad, compras, descargas y dashboard admin de marzo de 2026.

## Cerrado

- La vulnerabilidad original no se reproduce para usuarios normales.
- El estado local de compras/descargas ya no se comparte entre cuentas.
- El dashboard admin ya no conserva métricas obsoletas tras limpiar los datos reales.
- Hay regresiones automáticas para:
  - aislamiento de estado por `uid`
  - métricas stale del dashboard
  - reglas de Firestore relevantes

## Prioridad Alta

### 1. Partir `admin-audit-renderer`

Archivo:
- `src/js/admin-audit-renderer.js`

Motivo:
- Sigue siendo el módulo más grande y frágil del flujo admin.
- Mezcla UI, auth, listeners, fallbacks, mapeo de datos y acciones destructivas.

Objetivo:
- Separar en módulos o helpers por responsabilidad:
  - lectura de fuentes
  - normalización de logs
  - render/UI
  - acciones admin

Riesgo actual:
- Alto coste de mantenimiento.
- Más probabilidad de regresiones al tocar cualquier parte del monitor.

### 2. Partir `functions/index.js`

Archivo:
- `functions/index.js`

Motivo:
- Sigue concentrando demasiada lógica:
  - pagos
  - descargas
  - dashboard
  - auditoría
  - utilidades

Objetivo:
- Extraer por dominios:
  - checkout/pagos
  - compras/descargas
  - dashboard/admin
  - helpers compartidos

Riesgo actual:
- Archivo demasiado grande para revisar o modificar con seguridad.

### 3. Reducir complejidad de `post-checkout-handler`

Archivo:
- `src/js/post-checkout-handler.js`

Motivo:
- Sigue mezclando:
  - parsing de URL
  - verificación
  - persistencia
  - limpieza de carrito
  - UI/modal
  - analytics
  - reintentos

Objetivo:
- Extraer al menos:
  - `checkout-verification`
  - `checkout-persistence`
  - `checkout-ui-state`

Riesgo actual:
- Coste alto para razonar cambios del retorno de checkout.

## Prioridad Media

### 4. Simplificar fuentes de métricas del dashboard

Archivo:
- `src/js/admin-dashboard-data.js`

Motivo:
- Sigue manejando múltiples fuentes:
  - `orders`
  - `collectionGroup('purchases')`
  - `users.purchases`
  - snapshot servidor
  - baseline local

Objetivo:
- Reducir el número de fuentes de verdad.
- Documentar la precedencia exacta.

Riesgo actual:
- Riesgo de futuras inconsistencias si reaparecen datos parciales.

### 5. Reducir fallback dual en compras admin

Archivo:
- `src/js/purchases-list-modal.js`

Motivo:
- Mantiene doble camino:
  - callable backend
  - fallback directo a Firestore

Objetivo:
- Dejar una vía principal clara.
- Mantener fallback solo si está justificado y documentado.

### 6. Reducir acoplamiento global entre módulos públicos

Archivos principales:
- `src/js/announcement-system.js`
- `src/js/ultimate-download-manager.js`
- `src/js/post-checkout-handler.js`

Motivo:
- Dependencia fuerte de `window.*`, eventos custom y `localStorage`.

Objetivo:
- Centralizar contratos mínimos entre módulos.
- Reducir dependencia implícita global.

## Prioridad Baja

### 7. Revisar comentarios y branches heredadas fuera del alcance tocado

Motivo:
- Aún quedan comentarios históricos y ramas fallback heredadas en módulos no intervenidos.

Objetivo:
- Limpiar progresivamente sin mezclarlo con cambios funcionales.

### 8. Mejorar la estrategia `src/js` -> `public/js`

Motivo:
- El mirror funciona, pero sigue siendo deuda estructural.

Objetivo:
- Evaluar si se puede reducir duplicación o automatizar aún más el flujo.

## Posibles pruebas futuras

- E2E real de cambio de cuenta en el mismo navegador.
- E2E de post-checkout con redirect y restauración tardía de Auth.
- Smoke admin del monitor de auditoría con varias fuentes de compra.

## Notas

- No mezclar estas tareas con los cambios no relacionados ya presentes en el árbol del repo.
- Mantener commits pequeños y por bloque funcional.
- Repetir al menos:
  - `npm run lint`
  - `npm run test`
  - `npm run test:rules`
  - `npm run mirror:check`

## Referencias

- `SECURITY_FIX_REPORT.md`
- commits en la rama `codex/stripe-runtime-e2e-hardening`
