param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $true)]
  [string]$GitHubOwner,

  [Parameter(Mandatory = $true)]
  [string]$GitHubRepo,

  # Lock to a branch/tag ref. Example: refs/heads/main
  [string]$AllowedRef = "refs/heads/main",

  # Names are project-global; keep them stable.
  [string]$PoolId = "github-pool",
  [string]$ProviderId = "github-provider",
  [string]$DeployServiceAccountId = "github-hosting-deployer"
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "Missing required command: $Name" }
}

Require-Command "gcloud"

$repoRoot = (Get-Location).Path
$cfgDir = Join-Path (Get-Location) ".gcloud"
New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null
$env:CLOUDSDK_CONFIG = $cfgDir

function Run-Gcloud {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )
  $out = & gcloud @Args 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ("gcloud {0} failed:`n{1}" -f ($Args -join ' '), $out)
  }
  return $out
}

Run-Gcloud @("config","set","project",$ProjectId) | Out-Null

$projectNumber = (Run-Gcloud @("projects","describe",$ProjectId,"--format=value(projectNumber)")).Trim()
if (-not $projectNumber) { throw "Could not resolve projectNumber for $ProjectId" }

$location = "global"
$issuer = "https://token.actions.githubusercontent.com"

Write-Host "Project: $ProjectId ($projectNumber)"
Write-Host "Repo allowlist: $GitHubOwner/$GitHubRepo @ $AllowedRef"

# 1) Workload Identity Pool (idempotent)
$poolExists = $false
try {
  & gcloud iam workload-identity-pools describe $PoolId --location $location --project $ProjectId 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) { $poolExists = $true }
} catch { $poolExists = $false }

if (-not $poolExists) {
  Write-Host "Creating WIF pool: $PoolId"
  Run-Gcloud @(
    "iam","workload-identity-pools","create",$PoolId,
    "--location",$location,
    "--project",$ProjectId,
    "--display-name","GitHub Actions Pool"
  ) | Out-Null
}

# 2) Provider (idempotent)
$providerExists = $false
try {
  & gcloud iam workload-identity-pools providers describe $ProviderId `
    --location $location `
    --workload-identity-pool $PoolId `
    --project $ProjectId 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) { $providerExists = $true }
} catch { $providerExists = $false }

if (-not $providerExists) {
  Write-Host "Creating provider: $ProviderId"

  $attributeMapping = @(
    "google.subject=assertion.sub",
    "attribute.repository=assertion.repository",
    "attribute.ref=assertion.ref",
    "attribute.actor=assertion.actor"
  ) -join ","

  # Restrict to one repo + one ref (branch)
  $condition = "assertion.repository=='$GitHubOwner/$GitHubRepo' && assertion.ref=='$AllowedRef'"

  Run-Gcloud @(
    "iam","workload-identity-pools","providers","create-oidc",$ProviderId,
    "--location",$location,
    "--workload-identity-pool",$PoolId,
    "--project",$ProjectId,
    "--display-name","GitHub Actions Provider",
    "--issuer-uri",$issuer,
    "--attribute-mapping",$attributeMapping,
    "--attribute-condition",$condition
  ) | Out-Null
}

# 3) Dedicated deploy service account (no keys)
$saEmail = "$DeployServiceAccountId@$ProjectId.iam.gserviceaccount.com"
$saExists = $false
try {
  & gcloud iam service-accounts describe $saEmail --project $ProjectId 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) { $saExists = $true }
} catch { $saExists = $false }

if (-not $saExists) {
  Write-Host "Creating service account: $saEmail"
  Run-Gcloud @(
    "iam","service-accounts","create",$DeployServiceAccountId,
    "--project",$ProjectId,
    "--display-name","GitHub Hosting Deployer (keyless)"
  ) | Out-Null
}

# 4) Minimal roles for Firebase Hosting deploy
# Note: Firebase deploy uses Firebase Hosting APIs; keep the role scoped to hosting.
Write-Host "Granting roles/firebasehosting.admin to $saEmail"
Run-Gcloud @(
  "projects","add-iam-policy-binding",$ProjectId,
  "--member","serviceAccount:$saEmail",
  "--role","roles/firebasehosting.admin",
  "-q"
) | Out-Null

# Some environments need this to call enabled services.
Write-Host "Granting roles/serviceusage.serviceUsageConsumer to $saEmail"
Run-Gcloud @(
  "projects","add-iam-policy-binding",$ProjectId,
  "--member","serviceAccount:$saEmail",
  "--role","roles/serviceusage.serviceUsageConsumer",
  "-q"
) | Out-Null

# 5) Allow GitHub OIDC principal-set to impersonate the deploy service account
$principalSet = "principalSet://iam.googleapis.com/projects/$projectNumber/locations/$location/workloadIdentityPools/$PoolId/attribute.repository/$GitHubOwner/$GitHubRepo"

Write-Host "Binding roles/iam.workloadIdentityUser on $saEmail to:"
Write-Host "  $principalSet"

gcloud iam service-accounts add-iam-policy-binding $saEmail `
  --project $ProjectId `
  --role "roles/iam.workloadIdentityUser" `
  --member $principalSet | Out-Null

$providerResource = "projects/$projectNumber/locations/$location/workloadIdentityPools/$PoolId/providers/$ProviderId"

Write-Host ""
Write-Host "WIF ready. Use these in GitHub Actions:"
Write-Host "  workload_identity_provider: $providerResource"
Write-Host "  service_account: $saEmail"
