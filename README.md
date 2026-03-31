# WifiHackX v2

Web app for WiFi security auditing workflows, admin operations, and secure checkout flows.

## Local Development

- Setup and secure localhost auth/app-check flow: `docs/LOCAL_DEV.md`

## Release

- Final freeze checklist: `docs/RELEASE_FREEZE.md`
- Stripe deploy seguro por env var (sin hardcode): `npm run deploy:hosting:stripe`

## Quality Gates

- Local full release check: `npm run release:final`
- Fast local dry run: `npm run release:final:fast`
- Stripe-aware full release check: `npm run release:final:stripe`
- CI-safe release gate: `npm run release:final:ci`
- Mirror sync: `npm run mirror:sync`
- Mirror edit guard: `npm run mirror:guard`
- Mirror consistency gate: `npm run mirror:check:strict`
- Mirror workflow and exceptions: `docs/MIRROR_WORKFLOW.md`
- Lighthouse budgets gate:
  - `npm run lighthouse:ci:pr` for pull requests (`lighthouserc.pr.json`)
  - `npm run lighthouse:ci:strict` for main/nightly (`lighthouserc.json`)
- Public config hardening check: `npm run validate:public-config`
- Public config hardening check (prod strict): `npm run validate:public-config:prod`

## E2E Smoke

- Local run:
  - `$env:WFX_E2E_ADMIN_EMAIL='admin@example.com'`
  - `$env:WFX_E2E_ADMIN_PASSWORD='***'`
  - `npm run test:e2e:smoke`
- GitHub Actions manual workflow:
  - Workflow: `.github/workflows/e2e-smoke.yml`
  - Required repository secrets:
    - `WFX_E2E_ADMIN_EMAIL`
    - `WFX_E2E_ADMIN_PASSWORD`

## Console Hardening

- Manual checklist for key/domain restrictions:
  - `docs/CONSOLE_KEY_RESTRICTIONS_CHECKLIST.md`

## Stripe Key Injection (Safe)

- Keep `index.html` with `"stripePublicKey": ""` in Git.
- Inject at build/deploy time with env var:
  - PowerShell:
    - `$env:WFX_STRIPE_PUBLIC_KEY='pk_live_...'; npm run deploy:hosting:stripe`
  - Or:
    - `npm run deploy:hosting:stripe -- -StripePublicKey 'pk_live_...'`
# Seguridad DOM

El repo incluye una auditoría automática de regresiones de frontend:

- `npm run security:scan:frontend`
- `npm run security:scan`

La comprobación compara los patrones sensibles actuales de `src/js` contra [tools/frontend-dom-safety-baseline.json](C:/Users/Internet/Desktop/WifiHackX/tools/frontend-dom-safety-baseline.json) y falla si aparecen casos nuevos de:

- selectores CSS interpolados,
- atributos HTML interpolados,
- `innerHTML` con template literals.

## Cuándo actualizar la baseline

Actualízala solo si el patrón nuevo es intencional y ya fue revisado manualmente como seguro.

Ejemplos válidos:

- el valor interpolado ya pasa por `escapeAttr`, `sanitizeHttpUrl` o helper equivalente,
- el `innerHTML` es completamente estático o usa solo contenido saneado,
- el selector dinámico no puede sustituirse razonablemente y el valor interpolado está controlado y acotado.

## Cuándo NO actualizar la baseline

No la actualices para “hacer pasar CI” si el cambio nuevo:

- interpola datos no confiables en HTML o atributos,
- construye `querySelector(...)` con ids, emails o `data-*` variables,
- usa URLs sin validación previa,
- reintroduce `error.message`, `dataset`, `localStorage` o backend data en render directo.

En esos casos, corrige el código primero y deja la baseline intacta.
