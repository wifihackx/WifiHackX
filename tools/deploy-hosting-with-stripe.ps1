param(
  [Parameter(Mandatory = $false)]
  [string]$StripePublicKey
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

$env:WFX_STRIPE_PUBLIC_KEY = $key
Write-Host "[OK] Stripe public key loaded from environment for this deploy session." -ForegroundColor Green

Write-Host "==> Build + deploy check with Stripe key injection" -ForegroundColor Cyan
npm run deploy:check
if ($LASTEXITCODE -ne 0) {
  Fail "deploy:check failed"
}

Write-Host "[PASS] deploy-hosting-with-stripe completed" -ForegroundColor Green
