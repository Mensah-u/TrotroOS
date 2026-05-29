# Start Metro on a fixed LAN port with QR (no port prompts, works offline).
param([int]$Port = 8081)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*(#|$)') { return }
    if ($_ -match '^([^=]+)=(.*)$') {
      Set-Item -Path "Env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
  }
}

Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and
    $_.PrefixOrigin -in @('Dhcp', 'Manual', 'RouterAdvertisement')
  } |
  Sort-Object InterfaceMetric |
  Select-Object -First 1 -ExpandProperty IPAddress)

if (-not $ip) { $ip = 'localhost' }

$env:EXPO_OFFLINE = '1'
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
Remove-Item Env:CI -ErrorAction SilentlyContinue

& "$PSScriptRoot\show-qr.ps1" -Port $Port

npx expo start -c --lan --port $Port
