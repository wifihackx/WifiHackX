param(
  [string]$ProjectId = "white-caster-466401-g0",
  [int]$HoursBack = 24,
  [string]$OutDir = "",
  [string]$CloudSdkConfig = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$PathValue) {
  if (-not (Test-Path -LiteralPath $PathValue)) {
    New-Item -ItemType Directory -Path $PathValue | Out-Null
  }
}

function Save-Text([string]$PathValue, [string]$Content) {
  Set-Content -LiteralPath $PathValue -Value $Content -Encoding UTF8
}

function To-IsoUtc([datetime]$Dt) {
  return $Dt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

if (-not $OutDir -or $OutDir.Trim().Length -eq 0) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutDir = Join-Path -Path "forensics" -ChildPath ("auth-" + $stamp)
}
Ensure-Dir $OutDir

if (-not $CloudSdkConfig -or $CloudSdkConfig.Trim().Length -eq 0) {
  $localCfg = Join-Path -Path (Get-Location) -ChildPath ".gcloud"
  if (Test-Path -LiteralPath $localCfg) {
    $CloudSdkConfig = (Resolve-Path -LiteralPath $localCfg).Path
  }
}

if ($CloudSdkConfig -and $CloudSdkConfig.Trim().Length -gt 0) {
  $env:CLOUDSDK_CONFIG = $CloudSdkConfig
}

$fromUtc = (Get-Date).AddHours(-1 * [Math]::Abs($HoursBack))
$fromIso = To-IsoUtc $fromUtc
$untilIso = To-IsoUtc (Get-Date)
$freshness = ([Math]::Abs($HoursBack)).ToString() + "h"

$header = @()
$header += "Forensics window (UTC): $fromIso -> $untilIso"
$header += "Project: $ProjectId"
$header += "Cloud SDK config: $($env:CLOUDSDK_CONFIG)"
$headerText = ($header -join [Environment]::NewLine)
Save-Text -PathValue (Join-Path $OutDir "00_window.txt") -Content $headerText

$identityQuery = 'protoPayload.serviceName="identitytoolkit.googleapis.com"'

$setInfoQuery = @(
  'protoPayload.serviceName="identitytoolkit.googleapis.com"',
  'protoPayload.methodName="google.cloud.identitytoolkit.v1.AccountManagementService.SetAccountInfo"'
) -join " AND "

$deleteQuery = @(
  'protoPayload.serviceName="identitytoolkit.googleapis.com"',
  'protoPayload.methodName="google.cloud.identitytoolkit.v1.AccountManagementService.DeleteAccount"'
) -join " AND "

$oobQuery = @(
  'protoPayload.serviceName="identitytoolkit.googleapis.com"',
  'protoPayload.methodName="google.cloud.identitytoolkit.v1.AccountManagementService.GetOobCode"'
) -join " AND "

$claimsFnQuery = @(
  'resource.type="cloud_function"',
  'resource.labels.function_name="setAdminClaims"'
) -join " AND "

$jsonFiles = @{
  IdentityAll = Join-Path $OutDir "10_identity_all.json"
  SetAccountInfo = Join-Path $OutDir "11_set_account_info.json"
  DeleteAccount = Join-Path $OutDir "12_delete_account.json"
  GetOobCode = Join-Path $OutDir "13_get_oob_code.json"
  SetAdminClaimsFn = Join-Path $OutDir "14_set_admin_claims_function.json"
}

& gcloud logging read $identityQuery --project=$ProjectId --freshness=$freshness --limit=1000 --format=json | Out-File -LiteralPath $jsonFiles.IdentityAll -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "gcloud logging read identity query failed" }
& gcloud logging read $setInfoQuery --project=$ProjectId --freshness=$freshness --limit=1000 --format=json | Out-File -LiteralPath $jsonFiles.SetAccountInfo -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "gcloud logging read setAccountInfo query failed" }
& gcloud logging read $deleteQuery --project=$ProjectId --freshness=$freshness --limit=1000 --format=json | Out-File -LiteralPath $jsonFiles.DeleteAccount -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "gcloud logging read deleteAccount query failed" }
& gcloud logging read $oobQuery --project=$ProjectId --freshness=$freshness --limit=1000 --format=json | Out-File -LiteralPath $jsonFiles.GetOobCode -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "gcloud logging read getOobCode query failed" }
& gcloud logging read $claimsFnQuery --project=$ProjectId --freshness=$freshness --limit=1000 --format=json | Out-File -LiteralPath $jsonFiles.SetAdminClaimsFn -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "gcloud logging read setAdminClaims function query failed" }

$fnLogPath = Join-Path $OutDir "15_set_admin_claims_function_logs.txt"
& gcloud functions logs read setAdminClaims --region=us-central1 --limit=300 | Out-File -LiteralPath $fnLogPath -Encoding utf8

function Read-JsonArray([string]$PathValue) {
  if (-not (Test-Path -LiteralPath $PathValue)) { return @() }
  $raw = Get-Content -LiteralPath $PathValue -Raw
  if (-not $raw -or $raw.Trim().Length -eq 0) { return @() }
  try {
    $data = $raw | ConvertFrom-Json
  } catch {
    return @()
  }
  if ($null -eq $data) { return @() }
  if ($data -is [System.Array]) { return $data }
  return @($data)
}

$setInfo = Read-JsonArray $jsonFiles.SetAccountInfo
$identityAll = Read-JsonArray $jsonFiles.IdentityAll
$claimsFn = Read-JsonArray $jsonFiles.SetAdminClaimsFn

$summaryPath = Join-Path $OutDir "99_summary.txt"
$lines = @()
$lines += $headerText
$lines += ""
$lines += "SetAccountInfo count: $($setInfo.Count)"
$lines += "Identity (all methods) count: $($identityAll.Count)"
$lines += "setAdminClaims function logs count: $($claimsFn.Count)"
$lines += ""

if ($setInfo.Count -gt 0) {
  $lines += "Top SetAccountInfo by principal:"
  $setInfo |
    Group-Object { $_.protoPayload.authenticationInfo.principalEmail } |
    Sort-Object Count -Descending |
    ForEach-Object { $lines += ("  {0} -> {1}" -f $_.Name, $_.Count) }

  $lines += ""
  $lines += "Top SetAccountInfo by callerIp:"
  $setInfo |
    Group-Object { $_.protoPayload.requestMetadata.callerIp } |
    Sort-Object Count -Descending |
    ForEach-Object { $lines += ("  {0} -> {1}" -f $_.Name, $_.Count) }

  $lines += ""
  $lines += "Top SetAccountInfo by localId:"
  $setInfo |
    Group-Object { $_.protoPayload.request.localId } |
    Sort-Object Count -Descending |
    ForEach-Object { $lines += ("  {0} -> {1}" -f $_.Name, $_.Count) }

  $lines += ""
  $lines += "Recent SetAccountInfo (timestamp | localId | principal | callerIp):"
  $setInfo |
    Sort-Object { $_.timestamp } -Descending |
    Select-Object -First 20 |
    ForEach-Object {
      $lines += ("  {0} | {1} | {2} | {3}" -f `
        $_.timestamp, `
        $_.protoPayload.request.localId, `
        $_.protoPayload.authenticationInfo.principalEmail, `
        $_.protoPayload.requestMetadata.callerIp)
    }
}

if ($identityAll.Count -gt 0) {
  $lines += ""
  $lines += "Identity methods frequency:"
  $identityAll |
    Group-Object { $_.protoPayload.methodName } |
    Sort-Object Count -Descending |
    ForEach-Object { $lines += ("  {0} -> {1}" -f $_.Name, $_.Count) }
}

Save-Text -PathValue $summaryPath -Content ($lines -join [Environment]::NewLine)

Write-Host "Forensics export complete:"
Write-Host "  Output dir: $OutDir"
Write-Host "  Summary: $summaryPath"
