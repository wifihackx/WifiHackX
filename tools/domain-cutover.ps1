param(
  [Parameter(Mandatory = $true)]
  [string]$Domain,
  [switch]$Deploy,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "[domain-cutover] $Message" -ForegroundColor Cyan
}

function Run-Command {
  param(
    [string]$Command,
    [string[]]$CommandArgs = @(),
    [hashtable]$ExtraEnv = @{}
  )

  Write-Host ("[domain-cutover] > " + $Command + " " + ($CommandArgs -join " "))

  $previous = @{}
  foreach ($key in $ExtraEnv.Keys) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
    [Environment]::SetEnvironmentVariable($key, $ExtraEnv[$key], "Process")
  }

  try {
    & $Command @CommandArgs
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code $LASTEXITCODE"
    }
  } finally {
    foreach ($key in $ExtraEnv.Keys) {
      [Environment]::SetEnvironmentVariable($key, $previous[$key], "Process")
    }
  }
}

function Check-Dns {
  param([string]$HostName)
  try {
    Resolve-DnsName $HostName | Out-Null
    Write-Host "[domain-cutover] DNS OK: $HostName" -ForegroundColor Green
    return $true
  } catch {
    Write-Host "[domain-cutover] DNS FAIL: $HostName -> $($_.Exception.Message)" -ForegroundColor Yellow
    return $false
  }
}

function Check-Https {
  param([string]$Url)
  try {
    $resp = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 20
    Write-Host "[domain-cutover] HTTPS OK: $Url ($($resp.StatusCode))" -ForegroundColor Green
    return $true
  } catch {
    Write-Host "[domain-cutover] HTTPS HEAD FAIL: $Url -> $($_.Exception.Message)" -ForegroundColor Yellow
    try {
      $resp = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 20
      Write-Host "[domain-cutover] HTTPS OK via GET: $Url ($($resp.StatusCode))" -ForegroundColor Green
      return $true
    } catch {
      Write-Host "[domain-cutover] HTTPS GET FAIL: $Url -> $($_.Exception.Message)" -ForegroundColor Yellow
      return $false
    }
  }
}

$canonicalUrl = "https://$Domain"
$wwwDomain = "www.$Domain"
$wwwUrl = "https://$wwwDomain"
$envVars = @{
  SITE_URL = $canonicalUrl
  SPRINT5_TARGET_URL = $canonicalUrl
}

Write-Step "Starting cutover checks for $Domain"

$dnsRoot = Check-Dns -HostName $Domain
$dnsWww = Check-Dns -HostName $wwwDomain
$httpsRoot = Check-Https -Url $canonicalUrl
$httpsWww = Check-Https -Url $wwwUrl

if (-not $dnsRoot -or -not $httpsRoot) {
  Write-Host "[domain-cutover] Root domain may not be fully reachable yet. Live validation below is the source of truth." -ForegroundColor Yellow
}

Write-Step "Generate SEO artifacts for $canonicalUrl"
Run-Command -Command "npm" -CommandArgs @("run", "sitemap") -ExtraEnv $envVars

Write-Step "Validate live headers and GTM for $canonicalUrl"
Run-Command -Command "node" -CommandArgs @("tools/validate-sprint5.js", "--live", "--url=$canonicalUrl") -ExtraEnv $envVars

if ($DryRun) {
  Write-Step "Dry run complete (no IndexNow / no deploy)"
  exit 0
}

Write-Step "Submit IndexNow"
Run-Command -Command "node" -CommandArgs @("tools/submit-indexnow.js") -ExtraEnv $envVars

if ($Deploy) {
  Write-Step "Deploy hosting"
  Run-Command -Command "firebase" -CommandArgs @("deploy", "--only", "hosting") -ExtraEnv $envVars
} else {
  Write-Step "Deploy skipped (use -Deploy to publish)"
}

Write-Step "Completed successfully"
