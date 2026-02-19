param(
  [string]$Url = "https://wifihackx.com"
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
  Write-Host "$name: $value" -ForegroundColor Green
}

Write-Step "Smoke test: $Url"
$head = Invoke-WebRequest -Method Head -Uri $Url
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
