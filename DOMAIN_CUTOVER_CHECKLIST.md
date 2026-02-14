# Domain Cutover Checklist

## Canonical decision (recommended)

- Canonical host: `https://wifihackx.com` (apex).
- Redirect host: `https://www.wifihackx.com` -> `https://wifihackx.com` (301).

Configure this in Firebase Hosting custom domain setup when adding both hosts.

## DNS readiness

1. Add the DNS records requested by Firebase for:
   - `wifihackx.com`
   - `www.wifihackx.com`
2. Wait for propagation.
3. Verify DNS from terminal:
   - `Resolve-DnsName wifihackx.com`
   - `Resolve-DnsName www.wifihackx.com`

## HTTPS readiness

1. Verify both URLs open with valid certificate:
   - `https://wifihackx.com`
   - `https://www.wifihackx.com`
2. Confirm redirect behavior is canonical.

## Cutover commands

Dry run first:

```powershell
powershell -ExecutionPolicy Bypass -File tools/domain-cutover.ps1 -Domain wifihackx.com -DryRun
```

Real cutover:

```powershell
powershell -ExecutionPolicy Bypass -File tools/domain-cutover.ps1 -Domain wifihackx.com -Deploy
```

## Post-cutover checks

1. `node tools/validate-sprint5.js --live --url=https://wifihackx.com`
2. Share URL check from footer and announcement cards.
3. Check `https://wifihackx.com/robots.txt`.
4. Check `https://wifihackx.com/sitemap.xml`.
5. Check `https://wifihackx.com/sitemap-images.xml`.

