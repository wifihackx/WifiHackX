# Anti-Bot Operations (Admin)

This project now includes anti-bot protections in registration with admin controls.

## Where to manage it

Open:
- `Admin Panel` -> `Configuración` -> `Configuración de Seguridad`

Relevant field:
- `Dominios bloqueados en registro (coma)`
  - Stored at: `settings/system-config.security.blockedRegistrationEmailDomains`
  - Format: CSV domains, e.g. `mailinator.com, yopmail.com`

## Built-in protections (server-side)

Callable:
- `preRegisterGuard` (`preRegisterGuardV2` preferred by frontend)

Checks:
- Honeypot field (`website`)
- Email format validation
- Blocked disposable domains
- Bot/headless user-agent detection
- IP-based rate limit (`3 requests / 60s`)

## Admin tools in Settings

Buttons:
- `Probar anti-bot`
  - Runs a safe simulation (`testMode`) and shows if bad payloads would be blocked.
- `Ver estadísticas`
  - Loads recent block stats from `security_logs`.
  - Shows:
    - `Bloqueos 1h`
    - `Bloqueos 24h`
    - top reasons

## Alert behavior

When opening Settings as admin:
- A warning is shown if registration blocks in the last hour reach threshold.
- Current threshold from backend response: `thresholdWarnHour = 10`.
- Check is throttled per session (10 minutes) to avoid noisy alerts.

## Common block reasons

- `honeypot_filled`
- `invalid_email`
- `blocked_email_domain`
- `bot_user_agent`
- `rate_limit`

## Incident response quick steps

1. Open `Configuración de Seguridad`.
2. Click `Ver estadísticas`.
3. If attack pattern is domain-based:
   - add domains to `Dominios bloqueados en registro (coma)`.
   - click `Guardar cambios`.
4. Click `Probar anti-bot` to confirm expected behavior.
5. Re-check `Ver estadísticas` after a few minutes.

