param(
  [string]$Url = "https://white-caster-466401-g0.web.app"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Assert-Header($headers, $name) {
  $value = $headers[$name]
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing security header: $name"
  }
  Write-Host ("{0}: {1}" -f $name, $value) -ForegroundColor Green
}

Write-Step "Smoke test: $Url"
try {
  $head = Invoke-WebRequest -Method Head -Uri $Url
} catch {
  $detail = $_.Exception.Message
  throw "Smoke request failed for '$Url' (network/DNS): $detail"
}
if ($head.StatusCode -lt 200 -or $head.StatusCode -ge 400) {
  throw "Unexpected status code: $($head.StatusCode)"
}
Write-Host "HTTP status: $($head.StatusCode)" -ForegroundColor Green

$page = Invoke-WebRequest -Method Get -Uri $Url
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
