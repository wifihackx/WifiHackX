param(
  [switch]$Strict
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$patterns = @(
  @{ Name = 'Stripe secret key'; Severity = 'critical'; Regex = 'sk_(live|test)_[A-Za-z0-9]{16,}' },
  @{ Name = 'Stripe webhook secret'; Severity = 'critical'; Regex = 'whsec_[A-Za-z0-9]{16,}' },
  @{ Name = 'Google API key'; Severity = 'warn'; Regex = 'AIza[0-9A-Za-z_\-]{30,}' },
  @{ Name = 'Private key block'; Severity = 'critical'; Regex = '-----BEGIN (RSA |EC )?PRIVATE KEY-----' },
  @{ Name = 'Firebase service account file ref'; Severity = 'warn'; Regex = 'firebase-adminsdk-[^"''\s]+\.json' },
  @{ Name = 'Generic secret assignment'; Severity = 'warn'; Regex = '(?i)(api[_-]?key|secret|token|private[_-]?key)\s*[:=]\s*["''][^"'']{12,}["'']' }
)

$globs = @(
  '--glob', '!node_modules/**',
  '--glob', '!functions/node_modules/**',
  '--glob', '!dist/**',
  '--glob', '!.git/**',
  '--glob', '!.firebase/**',
  '--glob', '!forensics/**',
  '--glob', '!playwright-report/**',
  '--glob', '!test-results/**',
  '--glob', '!.tmp/**',
  '--glob', '!.gcloud/**'
)

$criticalCount = 0
$warningCount = 0

Write-Host "== Secret Scan ==" -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host ""

foreach ($pattern in $patterns) {
  $args = @('-n', '-S') + $globs + @('--', $pattern.Regex, '.')
  $results = & rg @args 2>$null
  if (-not $results) { continue }

  if ($pattern.Severity -eq 'critical') {
    $criticalCount += ($results | Measure-Object).Count
    $color = 'Red'
  } else {
    $warningCount += ($results | Measure-Object).Count
    $color = 'Yellow'
  }

  Write-Host "[$($pattern.Severity.ToUpper())] $($pattern.Name)" -ForegroundColor $color
  $results | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
  if (($results | Measure-Object).Count -gt 20) {
    Write-Host "  ... (truncated)"
  }
  Write-Host ""
}

Write-Host "Summary: critical=$criticalCount warning=$warningCount" -ForegroundColor Cyan

if ($criticalCount -gt 0 -or ($Strict -and $warningCount -gt 0)) {
  exit 1
}
exit 0
