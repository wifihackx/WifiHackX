# Duplicacion src/public - Estado actual

Fecha: 2026-03-21T14:25:20.372Z

## Politica

- Fuente unica de verdad: `src/`
- `public/` se trata como artefacto sincronizado para `js` y `css`.
- Excepciones explicitas por root:
  - js: local-dev-config.js
  - css: (sin excepciones)

## Sync

- Resumen: js: copied=0 deleted=0 publicOnly=1 | css: copied=0 deleted=0 publicOnly=0

## Resumen

- JS compartidos por ruta: 130
- JS identicos (hash normalizado): 130
- JS distintos por ruta: 0
- JS solo en src: 0
- JS solo en public: 0
- CSS compartidos por ruta: 39
- CSS identicos (hash normalizado): 39
- CSS distintos por ruta: 0
- CSS solo en src: 0
- CSS solo en public: 0

## Lotes activos

- Announcement foundation [active]: announcement-admin-init.js, announcement-form-handler.js, announcement-public-modal.js, announcement-system.js, announcement-utils.js, cart-manager.js, post-checkout-handler.js, ultimate-download-manager.js

## Guardas activas

- `npm run mirror:sync` sincroniza `src -> public`.
- `npm run mirror:guard` falla si se edita un espejo en `public/` sin tocar su fuente en `src/`.
- `npm run mirror:check:strict` bloquea deriva nueva en CI.

## Artefactos

- Detalle completo en `tools/duplication-audit.json`.
- Baseline estricta en `tools/mirror-baseline.json`.
