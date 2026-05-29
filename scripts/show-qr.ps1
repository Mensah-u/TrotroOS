# Print Expo Go QR for the LAN URL Metro is using.
param([int]$Port = 8081)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening -and $Port -eq 8081) {
  $alt = Get-NetTCPConnection -LocalPort 8084 -State Listen -ErrorAction SilentlyContinue
  if ($alt) { $Port = 8084 }
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and
    $_.PrefixOrigin -in @('Dhcp', 'Manual', 'RouterAdvertisement')
  } |
  Sort-Object InterfaceMetric |
  Select-Object -First 1 -ExpandProperty IPAddress)

if (-not $ip) { $ip = 'localhost' }

$url = "exp://$ip`:$Port"
Write-Host ""
Write-Host "=== TrotroOS - Expo Go ===" -ForegroundColor Cyan
Write-Host "URL: $url"
Write-Host "Phone and PC must be on the same Wi-Fi." -ForegroundColor DarkGray
Write-Host ""

node -e "require('qrcode-terminal').generate(process.argv[1], { small: true })" $url

Write-Host ""
Write-Host "Re-print anytime:  npm run qr" -ForegroundColor Yellow
Write-Host ""
