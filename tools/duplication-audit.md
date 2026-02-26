# Duplicacion src/public - Estado actual

Fecha: 2026-02-26T00:50:32.680Z

## Resumen

- JS compartidos por ruta: 142
- JS identicos (hash): 103
- JS distintos por ruta: 39
- JS solo en src: 0
- JS solo en public: 0
- CSS compartidos por ruta: 39
- CSS identicos (hash): 38
- CSS distintos por ruta: 1
- CSS solo en src: 0
- CSS solo en public: 0

## Estado

- Paridad completa alcanzada entre src/public para rutas equivalentes.
- Sin diferencias por hash en archivos compartidos.

## Recomendacion

1. Mantener `src` como fuente unica de verdad.
2. Usar `npm run mirror:check:strict` en CI para bloquear deriva nueva.
3. Evitar ediciones manuales en un solo lado del espejo.

## Artefacto tecnico

- Detalle completo en `tools/duplication-audit.json`.
