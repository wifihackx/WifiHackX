param(
  [Parameter(Mandatory = $false)]
  [string]$StripePublicKey,
  [string]$Url = "https://white-caster-466401-g0.web.app",
  [switch]$SkipDeploy,
  [switch]$SkipLighthouse,
  [switch]$SkipSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
  Write-Host "[FAIL] $Message" -ForegroundColor Red
  exit 1
}

$key = $StripePublicKey
if ([string]::IsNullOrWhiteSpace($key)) {
  $key = $env:WFX_STRIPE_PUBLIC_KEY
}
$key = [string]$key
$key = $key.Trim()

if ([string]::IsNullOrWhiteSpace($key)) {
  Fail "Missing Stripe public key. Provide -StripePublicKey or set WFX_STRIPE_PUBLIC_KEY."
}

if ($key -notmatch '^pk_(live|test)_[A-Za-z0-9]+$') {
  Fail "Invalid Stripe public key format. Expected pk_live_... or pk_test_..."
}

$previous = $env:WFX_STRIPE_PUBLIC_KEY
$env:WFX_STRIPE_PUBLIC_KEY = $key
Write-Host "[OK] Stripe public key loaded from environment for this deploy session." -ForegroundColor Green

try {
  Write-Host "==> Build + deploy check with Stripe key injection" -ForegroundColor Cyan
  $deployCmd = "powershell -ExecutionPolicy Bypass -File tools/deploy-check.ps1 -Url `"$Url`""
  if ($SkipDeploy) { $deployCmd += " -SkipDeploy" }
  if ($SkipLighthouse) { $deployCmd += " -SkipLighthouse" }
  if ($SkipSmoke) { $deployCmd += " -SkipSmoke" }
  Invoke-Expression $deployCmd
  if ($LASTEXITCODE -ne 0) {
    Fail "deploy:check failed"
  }

  Write-Host "[PASS] deploy-hosting-with-stripe completed" -ForegroundColor Green
}
finally {
  if ($null -eq $previous) {
    Remove-Item Env:WFX_STRIPE_PUBLIC_KEY -ErrorAction SilentlyContinue
  } else {
    $env:WFX_STRIPE_PUBLIC_KEY = $previous
  }
}
