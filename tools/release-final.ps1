param(
  [string]$Url = "https://white-caster-466401-g0.web.app",
  [switch]$UseStripe,
  [string]$StripePublicKey,
  [string]$TagVersion,
  [string]$TagMessage,
  [switch]$SkipDeploy,
  [switch]$SkipLighthouse,
  [switch]$SkipTests,
  [switch]$SkipLiveValidation,
  [switch]$SkipSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Run-Cmd([string]$Label, [string]$Command) {
  Write-Step $Label
  Write-Host $Command -ForegroundColor DarkGray
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command"
  }
}

function Get-GitStatusShort() {
  $output = git status --short
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read git status"
  }
  return ($output | Out-String).Trim()
}

Write-Host "Release final started" -ForegroundColor Yellow
Write-Host "Target URL: $Url" -ForegroundColor Yellow

Run-Cmd "Mirror strict check" "npm run mirror:check:strict"
Run-Cmd "Security scan" "npm run security:scan"

if (-not $SkipTests) {
  Run-Cmd "Full tests + build" "npm run test:all"
} else {
  Write-Step "Tests skipped by flag (-SkipTests)"
}

Run-Cmd "Validate dist" "npm run validate:dist"
Run-Cmd "Validate sprint5 (config)" "npm run validate:sprint5"

if ($UseStripe) {
  $stripeCmd = "powershell -ExecutionPolicy Bypass -File tools/deploy-hosting-with-stripe.ps1 -Url `"$Url`""
  if ($SkipDeploy) { $stripeCmd += " -SkipDeploy" }
  if ($SkipLighthouse) { $stripeCmd += " -SkipLighthouse" }
  if ($SkipSmoke) { $stripeCmd += " -SkipSmoke" }
  if (-not [string]::IsNullOrWhiteSpace($StripePublicKey)) {
    $stripeCmd += " -StripePublicKey `"$StripePublicKey`""
  }
  Run-Cmd "Deploy check with Stripe key injection" $stripeCmd
} else {
  $deployCmd = "powershell -ExecutionPolicy Bypass -File tools/deploy-check.ps1 -Url `"$Url`""
  if ($SkipDeploy) { $deployCmd += " -SkipDeploy" }
  if ($SkipLighthouse) { $deployCmd += " -SkipLighthouse" }
  if ($SkipSmoke) { $deployCmd += " -SkipSmoke" }
  Run-Cmd "Deploy check" $deployCmd
}

if (-not $SkipLiveValidation) {
  Run-Cmd "Validate sprint5 live" "npm run validate:sprint5:live -- --url=$Url"
} else {
  Write-Step "Live validation skipped by flag (-SkipLiveValidation)"
}

$status = Get-GitStatusShort
Write-Step "Git status"
if ([string]::IsNullOrWhiteSpace($status)) {
  Write-Host "clean working tree" -ForegroundColor Green
} else {
  Write-Host $status -ForegroundColor Yellow
}

if (-not [string]::IsNullOrWhiteSpace($TagVersion)) {
  if (-not [string]::IsNullOrWhiteSpace($status)) {
    throw "Refusing to create tag with dirty working tree"
  }
  $msg = if ([string]::IsNullOrWhiteSpace($TagMessage)) {
    "Release $TagVersion"
  } else {
    $TagMessage
  }
  Run-Cmd "Create git tag" "git tag -a $TagVersion -m `"$msg`""
  Write-Host "[OK] Tag created: $TagVersion" -ForegroundColor Green
  Write-Host "Push with: git push origin $TagVersion" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "[PASS] release-final completed" -ForegroundColor Green
