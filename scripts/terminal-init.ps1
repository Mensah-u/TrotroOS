# Bootstrap for TrotroOS dev terminals (VS Code profile + manual use).
$ProjectRoot = 'C:\Users\HP\Documents\TrotroOSv2'

if (Test-Path $ProjectRoot) {
  Set-Location $ProjectRoot
}

# PowerShell binds "r" to Invoke-History, which re-runs the last command (often npm run qr).
# Metro reload is only "r" inside the Expo/Metro window.
if (Get-Alias r -ErrorAction SilentlyContinue) {
  Remove-Item alias:r -Force -ErrorAction SilentlyContinue
}

function global:metro-help {
  Write-Host ''
  Write-Host 'TrotroOS dev terminal' -ForegroundColor Cyan
  Write-Host "  Project: $ProjectRoot" -ForegroundColor DarkGray
  Write-Host '  npm start          - start Metro (scan QR in THAT window)' -ForegroundColor DarkGray
  Write-Host '  npm run restart    - restart Metro' -ForegroundColor DarkGray
  Write-Host '  npm run qr         - re-print QR (Metro must already be running)' -ForegroundColor DarkGray
  Write-Host '  npm run start:phone - tunnel mode if hotspot blocks LAN' -ForegroundColor DarkGray
  Write-Host ''
  Write-Host 'Reload the app: press r in the Metro window only, not in this tab.' -ForegroundColor Yellow
  Write-Host ''
}

metro-help
