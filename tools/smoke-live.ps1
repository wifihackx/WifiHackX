param(
  [string]$Url = "https://white-caster-466401-g0.web.app"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Invoke-WebRequestWithRetry {
  param(
    [ValidateSet("Head", "Get")]
    [string]$Method,
    [string]$Uri,
    [int]$MaxAttempts = 3
  )

  $attempt = 0
  while ($attempt -lt $MaxAttempts) {
    $attempt += 1
    try {
      return Invoke-WebRequest -Method $Method -Uri $Uri -TimeoutSec 20
    } catch {
      if ($attempt -ge $MaxAttempts) {
        throw
      }
      Start-Sleep -Seconds ([Math]::Min(5, $attempt * 2))
    }
  }
}

function Invoke-HeadWithFallback {
  param([string]$Uri)
  try {
    return Invoke-WebRequestWithRetry -Method Head -Uri $Uri
  } catch {
    $headersRaw = & curl.exe -sS -L -I --max-time 20 $Uri
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($headersRaw)) {
      throw
    }
    $statusRaw = & curl.exe -sS -L -o NUL -w "%{http_code}" --max-time 20 $Uri
    $statusCode = 0
    [void][int]::TryParse(($statusRaw | Out-String).Trim(), [ref]$statusCode)
    $headers = @{}
    foreach ($line in ($headersRaw | Out-String) -split "`r?`n") {
      if ($line -match '^\s*([^:]+):\s*(.*)$') {
        $headers[$matches[1].Trim().ToLowerInvariant()] = $matches[2].Trim()
      }
    }
    return [pscustomobject]@{
      StatusCode = $statusCode
      Headers = $headers
    }
  }
}

function Invoke-GetWithFallback {
  param([string]$Uri)
  try {
    return Invoke-WebRequestWithRetry -Method Get -Uri $Uri
  } catch {
    $content = & curl.exe -sS -L --max-time 20 $Uri
    if ($LASTEXITCODE -ne 0) {
      throw
    }
    return [pscustomobject]@{
      Content = ($content | Out-String)
    }
  }
}

function Assert-Header($headers, $name) {
  $value = $headers[$name]
  if ([string]::IsNullOrWhiteSpace($value)) {
    $value = $headers[$name.ToLowerInvariant()]
  }
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing security header: $name"
  }
  Write-Host ("{0}: {1}" -f $name, $value) -ForegroundColor Green
}

Write-Step "Smoke test: $Url"
try {
  $head = Invoke-HeadWithFallback -Uri $Url
} catch {
  $detail = $_.Exception.Message
  throw "Smoke request failed for '$Url' (network/DNS): $detail"
}
if ($head.StatusCode -lt 200 -or $head.StatusCode -ge 400) {
  throw "Unexpected status code: $($head.StatusCode)"
}
Write-Host "HTTP status: $($head.StatusCode)" -ForegroundColor Green

$page = Invoke-GetWithFallback -Uri $Url
if ([string]::IsNullOrWhiteSpace($page.Content)) {
  throw "Empty response body"
}
if ($page.Content -notmatch "WifihackX|WifiHackX|wifihackx") {
  throw "Expected brand text not found in HTML"
}
Write-Host "Content check: OK" -ForegroundColor Green

Write-Step "Security headers"
Assert-Header $head.Headers "content-security-policy"
Assert-Header $head.Headers "strict-transport-security"
Assert-Header $head.Headers "x-frame-options"

Write-Host ""
Write-Host "[PASS] smoke-live completed" -ForegroundColor Green
