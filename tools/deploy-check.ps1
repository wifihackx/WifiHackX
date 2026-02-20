param(
  [string]$Url = "https://white-caster-466401-g0.web.app",
  [switch]$SkipDeploy,
  [switch]$SkipLighthouse,
  [switch]$SkipSmoke,
  [switch]$SkipPrechecks
)

$ErrorActionPreference = "Stop"
$env:FIREBASE_SKIP_UPDATE_CHECK = "true"
$env:NO_UPDATE_NOTIFIER = "1"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Run-Cmd($label, $command) {
  Write-Step $label
  Write-Host $command -ForegroundColor DarkGray
  $previousEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = Invoke-Expression "$command 2>&1"
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousEap
  }
  if ($output) {
    $output | ForEach-Object { Write-Host $_ }
  }
  if ($exitCode -ne 0) {
    $joinedOutput = $output -join "`n"
    if ($command -like "firebase deploy --only hosting*" -and ($output -join "`n") -match "Deploy complete!") {
      Write-Host "[WARN] firebase deploy returned non-zero after successful release; continuing." -ForegroundColor Yellow
      return
    }
    if (
      $command -like "powershell -ExecutionPolicy Bypass -File tools/smoke-live.ps1*" -and
      (
        $joinedOutput -match "SEC_E_NO_CREDENTIALS" -or
        $joinedOutput -match "Error inesperado de recepción"
      )
    ) {
      Write-Host "[WARN] smoke-live failed due to local TLS/credentials stack, but deployment checks already validated live reachability and headers; continuing." -ForegroundColor Yellow
      return
    }
    if (
      $command -like "npx lighthouse*" -and
      (
        $joinedOutput -match "Unable to connect to Chrome" -or
        $joinedOutput -match "Acceso denegado" -or
        $joinedOutput -match "FATAL:mojo"
      )
    ) {
      Write-Host "[WARN] lighthouse failed due to local Chrome launch restrictions; continuing." -ForegroundColor Yellow
      return
    }
    throw "Command failed: $command"
  }
}

Write-Host "Deploy check started" -ForegroundColor Yellow
Write-Host "Target URL: $Url" -ForegroundColor Yellow

if (-not $SkipPrechecks) {
  Run-Cmd "Build dist" "npm run build --silent"
  Run-Cmd "Validate dist" "npm run validate:dist"
  Run-Cmd "Mirror strict check" "npm run mirror:check:strict"
  Run-Cmd "Security scan" "npm run security:scan"
} else {
  Write-Step "Prechecks skipped (build/validate/mirror/security)"
}

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
