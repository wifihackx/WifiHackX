# Duplicacion src/public - Estado actual

Fecha: 2026-02-18T18:04:15.015Z

## Resumen
- JS compartidos por ruta: 145
- JS identicos (hash): 75
- JS distintos por ruta: 70
- JS solo en src: 0
- JS solo en public: 0
- CSS compartidos por ruta: 38
- CSS identicos (hash): 38
- CSS distintos por ruta: 0
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
