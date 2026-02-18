param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $true)]
  [string]$ServiceAccountEmail,

  # Old key ID to revoke (private_key_id). If omitted, the script will only create a new key.
  [string]$OldKeyId = "",

  # Where to write the newly generated JSON key.
  [string]$OutDir = "private"
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Missing required command: $Name"
  }
}

Require-Command "gcloud"

# Ensure gcloud can write config/credentials inside the workspace.
$repoRoot = (Get-Location).Path
$cfgDir = Join-Path $repoRoot ".gcloud"
New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null
$env:CLOUDSDK_CONFIG = $cfgDir

Write-Host "Using CLOUDSDK_CONFIG=$cfgDir"

# Ensure we have a logged-in account (human) or another auth method.
$authList = & gcloud auth list 2>$null
if ($LASTEXITCODE -ne 0 -or ($authList -match "No credentialed accounts")) {
  Write-Host ""
  Write-Host "No gcloud credentials found in this workspace config."
  Write-Host "Run one of these, then re-run this script:"
  Write-Host "  gcloud auth login --no-launch-browser"
  Write-Host "  (or) gcloud auth application-default login --no-launch-browser"
  throw "Not authenticated"
}

& gcloud config set project $ProjectId | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$outFile = Join-Path $OutDir ("firebase-adminsdk-rotated-$timestamp.json")

Write-Host "Creating new key: $outFile"
& gcloud iam service-accounts keys create $outFile --iam-account $ServiceAccountEmail | Out-Null

Write-Host "New key created. Listing current keys:"
& gcloud iam service-accounts keys list --iam-account $ServiceAccountEmail --format "table(name,keyType,validAfterTime,validBeforeTime)" | Out-Host

if ($OldKeyId -and $OldKeyId.Trim().Length -gt 0) {
  Write-Host "Revoking old key id: $OldKeyId"
  # This accepts either the short key id or the full resource name.
  $deleteOutput = & gcloud iam service-accounts keys delete $OldKeyId --iam-account $ServiceAccountEmail -q 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Old key revoked."
  } else {
    # NOT_FOUND is expected if the key was already removed/rotated previously.
    Write-Host "WARN: Failed to revoke old key ($OldKeyId). It may already be deleted/revoked."
    if ($deleteOutput) { Write-Host $deleteOutput }
  }
}

Write-Host "Done."
