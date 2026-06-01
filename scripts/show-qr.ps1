# Print Expo Go QR for the LAN URL Metro is using.
param(
  [int]$Port = 8081,
  [switch]$Startup
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

. "$PSScriptRoot\get-lan-ip.ps1"

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening -and $Port -eq 8081) {
  $alt = Get-NetTCPConnection -LocalPort 8084 -State Listen -ErrorAction SilentlyContinue
  if ($alt) { $Port = 8084 }
}

$metroOk = $false
try {
  $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/status" -UseBasicParsing -TimeoutSec 2
  $metroOk = ($resp.Content -match 'packager-status:\s*running')
} catch {
  $metroOk = $false
}

if (-not $metroOk -and -not $Startup) {
  Write-Host ''
  Write-Host 'WARNING: Metro is NOT running - QR alone will not load the app.' -ForegroundColor Red
  Write-Host '  Start Metro first:  npm start   (or  npm run restart)' -ForegroundColor Yellow
  Write-Host '  Press r only in the Metro window, not in a normal PowerShell tab.' -ForegroundColor DarkGray
  Write-Host ''
}

$ip = Get-TrotroLanIp
$url = "exp://$ip`:$Port"

Write-Host ''
Write-Host '=== TrotroOS - Expo Go (phone) ===' -ForegroundColor Cyan
Write-Host "URL: $url"
Write-Host ''
Write-Host 'On your phone:' -ForegroundColor Yellow
Write-Host '  1. Open the Expo Go app (not the camera app on Android)' -ForegroundColor DarkGray
Write-Host '  2. Tap "Scan QR code"' -ForegroundColor DarkGray
Write-Host '  3. Point at the QR below (increase terminal font if too small)' -ForegroundColor DarkGray
Write-Host '  Or tap "Enter URL manually" and paste the URL above' -ForegroundColor DarkGray
Write-Host ''

if ($ip -like '192.168.43.*') {
  Write-Host 'Hotspot detected: PC is on your phone Wi-Fi. If scan fails, run: npm run start:phone' -ForegroundColor Yellow
  Write-Host ''
}

node -e "require('qrcode-terminal').generate(process.argv[1], { small: true })" $url

Write-Host ''
Write-Host 'Re-print QR anytime:  npm run qr' -ForegroundColor Yellow
Write-Host ''
