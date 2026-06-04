# Start Metro on a fixed LAN port with QR (no port prompts, works offline).
param(
  [int]$Port = 8081,
  [switch]$Tunnel,
  [switch]$ForceRestart,
  [switch]$ClearCache
)

Set-Location $PSScriptRoot\..

. "$PSScriptRoot\get-lan-ip.ps1"

$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
  $raw = Get-Content $envFile -Raw
  if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) {
    $raw = $raw.Substring(1)
  }
  $raw -split "`r?`n" | ForEach-Object {
    if ($_ -match '^\s*(#|$)') { return }
    if ($_ -match '^([^=]+)=(.*)$') {
      $key = $matches[1].Trim()
      $val = $matches[2].Trim().Trim('"').Trim("'")
      if ($key) { Set-Item -Path "Env:$key" -Value $val }
    }
  }
}

$ip = Get-TrotroLanIp

function Ensure-MetroFirewallRule {
  param([int]$RulePort = 8081)
  $name = "TrotroOS Metro $RulePort"
  try {
    if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $RulePort -Profile Private, Public -ErrorAction Stop | Out-Null
      Write-Host "Firewall: allowed inbound TCP $RulePort for Expo Go." -ForegroundColor DarkGray
    }
  } catch {
    try {
      & netsh advfirewall firewall add rule name=$name dir=in action=allow protocol=TCP localport=$RulePort profile=any | Out-Null
      Write-Host "Firewall: allowed inbound TCP $RulePort (netsh)." -ForegroundColor DarkGray
    } catch {
      Write-Host "Firewall blocked: run terminal as Admin once -> npm run fix:firewall" -ForegroundColor Yellow
      Write-Host "Or use tunnel (works without firewall): npm run start:phone" -ForegroundColor Yellow
    }
  }
}

Ensure-MetroFirewallRule -RulePort $Port

function Test-MetroHealthy {
  param([int]$CheckPort = 8081)
  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$CheckPort/status" -UseBasicParsing -TimeoutSec 2
    return ($resp.Content -match 'packager-status:\s*running')
  } catch {
    return $false
  }
}

$portPids = @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique)
$forceRestart = $ForceRestart -or ($env:TROTRO_RESTART -eq '1') -or ($args -contains '-Force')

if ($portPids.Count -gt 0 -and -not $forceRestart) {
  if (Test-MetroHealthy -CheckPort $Port) {
    Write-Host ''
    Write-Host "Metro is already running on port $Port." -ForegroundColor Green
    Write-Host "  exp://${ip}:${Port}" -ForegroundColor Yellow
    Write-Host '  Open Expo Go on your phone - press r in THIS window to reload.' -ForegroundColor Yellow
    Write-Host '  To restart: npm run restart' -ForegroundColor DarkGray
    Write-Host ''
    exit 0
  }
  Write-Host "Port $Port is in use but Metro is not responding - restarting..." -ForegroundColor Yellow
  $forceRestart = $true
}

if ($portPids.Count -gt 0) {
  foreach ($procId in $portPids) {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 500
}

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
Remove-Item Env:CI -ErrorAction SilentlyContinue
if ($Tunnel) {
  Remove-Item Env:EXPO_OFFLINE -ErrorAction SilentlyContinue
} else {
  # Offline skips Expo network checks but breaks manifest asset resolution in Expo Go.
  Remove-Item Env:EXPO_OFFLINE -ErrorAction SilentlyContinue
  $env:EXPO_NO_DEPENDENCY_VALIDATION = '1'
}

& "$PSScriptRoot\show-qr.ps1" -Port $Port -Startup

if ($Tunnel) {
  Write-Host 'Tunnel mode: phone can scan even if LAN is blocked (needs internet).' -ForegroundColor DarkGray
} else {
  Write-Host 'LAN mode: dependency validation skipped (faster start).' -ForegroundColor DarkGray
}
Write-Host 'If you see manifest asset warnings: connect this PC to the internet once, then npm run restart.' -ForegroundColor DarkGray
Write-Host 'Scan with Expo Go app on your phone (not Chrome). Watch for Android Bundled below.' -ForegroundColor DarkGray
Write-Host ""

# Continue on stderr from npx/expo (e.g. offline-mode notice) so Metro keeps running.
$ErrorActionPreference = 'Continue'
$clearCache = $ClearCache -or ($env:TROTRO_CLEAR_CACHE -eq '1')

$npxCmd = Get-Command npx.cmd -ErrorAction SilentlyContinue
$npx = if ($npxCmd) { $npxCmd.Source } else { 'npx' }

if ($Tunnel) {
  Write-Host 'Tunnel mode: slower first load but works when hotspot/firewall blocks LAN.' -ForegroundColor Yellow
}

if ($clearCache) {
  Write-Host "Clearing Metro cache (TROTRO_CLEAR_CACHE=1)..." -ForegroundColor Yellow
  if ($Tunnel) {
    & $npx expo start -c --tunnel --port $Port
  } else {
    & $npx expo start -c --lan --port $Port
  }
} elseif ($Tunnel) {
  & $npx expo start --tunnel --port $Port
} else {
  & $npx expo start --lan --port $Port
}
