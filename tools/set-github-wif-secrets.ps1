param(
  [string]$Repo = "wifihackx/WifiHackX",
  [Parameter(Mandatory = $true)]
  [string]$WifProvider,
  [Parameter(Mandatory = $true)]
  [string]$DeployServiceAccount
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "Missing required command: $Name" }
}

Require-Command "gh"

gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "GitHub CLI not authenticated. Run: gh auth login"
}

Write-Host "Setting GitHub secrets on $Repo"

Set-Content -Encoding ascii -NoNewline -Path "$env:TEMP\\wif_provider.txt" -Value $WifProvider
Set-Content -Encoding ascii -NoNewline -Path "$env:TEMP\\deploy_sa.txt" -Value $DeployServiceAccount

try {
  gh secret set GCP_WIF_PROVIDER --repo $Repo --body-file "$env:TEMP\\wif_provider.txt"
  gh secret set GCP_DEPLOY_SA --repo $Repo --body-file "$env:TEMP\\deploy_sa.txt"
} finally {
  Remove-Item -Force "$env:TEMP\\wif_provider.txt","$env:TEMP\\deploy_sa.txt" -ErrorAction SilentlyContinue
}

Write-Host "Done."

