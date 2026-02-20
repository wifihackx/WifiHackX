param(
  [string]$Url = "https://white-caster-466401-g0.web.app",
  [switch]$SkipDeploy,
  [switch]$SkipLighthouse,
  [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Run-Cmd($label, $command) {
  Write-Step $label
  Write-Host $command -ForegroundColor DarkGray
  Invoke-Expression $command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $command"
  }
}

Write-Host "Deploy check started" -ForegroundColor Yellow
Write-Host "Target URL: $Url" -ForegroundColor Yellow

Run-Cmd "Build dist" "npm run build --silent"
Run-Cmd "Validate dist" "npm run validate:dist"
Run-Cmd "Mirror strict check" "npm run mirror:check:strict"
Run-Cmd "Security scan" "npm run security:scan"

if (-not $SkipDeploy) {
  Run-Cmd "Deploy hosting" "firebase deploy --only hosting"
} else {
  Write-Step "Deploy skipped"
}

if (-not $SkipSmoke) {
  Run-Cmd "Live smoke test" "powershell -ExecutionPolicy Bypass -File tools/smoke-live.ps1 -Url `"$Url`""
} else {
  Write-Step "Live smoke test skipped"
}

if (-not $SkipLighthouse) {
  Run-Cmd "Lighthouse live run" "npx lighthouse `"$Url`" --output html --output-path .\lighthouse-prod.html"
} else {
  Write-Step "Lighthouse skipped"
}

Write-Host ""
Write-Host "[PASS] deploy-check completed" -ForegroundColor Green
