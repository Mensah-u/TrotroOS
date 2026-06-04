# Allow Expo Go on your phone to reach Metro (port 8081). Run terminal as Administrator once.
$ErrorActionPreference = 'Stop'
$Port = 8081
$name = "TrotroOS Metro $Port"

Write-Host ''
Write-Host '=== TrotroOS firewall (Expo Go / phone) ===' -ForegroundColor Cyan

$existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
if ($existing) {
  Enable-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Out-Null
  Write-Host "Rule already exists: $name (enabled)" -ForegroundColor Green
} else {
  try {
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Any -ErrorAction Stop | Out-Null
    Write-Host "Created firewall rule: allow inbound TCP $Port" -ForegroundColor Green
  } catch {
    Write-Host "Need Administrator to open port $Port automatically." -ForegroundColor Yellow
    Write-Host "Right-click Cursor terminal -> Run as Administrator, then: npm run fix:firewall" -ForegroundColor Yellow
    Write-Host "Or skip firewall: npm run start:phone (tunnel — works for phone scan)" -ForegroundColor Cyan
    exit 1
  }
}

$nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodePath) { $nodePath = 'C:\Program Files\nodejs\node.exe' }
$nodeRule = 'TrotroOS Node.js Metro'
if (-not (Get-NetFirewallRule -DisplayName $nodeRule -ErrorAction SilentlyContinue) -and (Test-Path $nodePath)) {
  New-NetFirewallRule -DisplayName $nodeRule -Direction Inbound -Action Allow -Program $nodePath -Profile Any | Out-Null
  Write-Host "Created firewall rule: allow Node.js ($nodePath)" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Done. Run: npm start  then scan QR in Expo Go.' -ForegroundColor DarkGray
Write-Host ''
