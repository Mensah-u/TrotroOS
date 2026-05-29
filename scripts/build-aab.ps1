# Build production AAB for Google Play
# Run from project root after: node scripts/check-release.js

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "TrotroOS — production AAB build" -ForegroundColor Cyan
Write-Host "Running release checks..." -ForegroundColor Yellow
node scripts/check-release.js
if ($LASTEXITCODE -ne 0) {
  Write-Host "Fix check-release errors before building." -ForegroundColor Red
  exit 1
}

Write-Host "Starting EAS production build (app-bundle)..." -ForegroundColor Green
eas build --platform android --profile production --non-interactive

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Download AAB from EAS dashboard"
Write-Host "  2. Upload to Play Console → Internal testing"
Write-Host "  3. eas submit --platform android --profile production  (after submit config)"
