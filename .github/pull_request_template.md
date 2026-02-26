## Summary

- What changed?
- Why was it needed?

## Risk / Impact

- Affected areas:
- Potential regressions:
- Rollback plan:

## Validation

- [ ] `npm run lint`
- [ ] `npx --yes knip`
- [ ] `npm run mirror:check:strict`
- [ ] `npm run build`
- [ ] `npm run validate:dist`
- [ ] `npm run test:rules`
- [ ] `npm run test:e2e:smoke` (if auth/admin/login flows changed)

## Evidence

- Screenshots / logs / notes:

## Security

- [ ] No secrets/keys committed
- [ ] Runtime config changes reviewed
- [ ] Stripe key remains injected via env/deploy process
