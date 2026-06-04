# Print SHA-1 for Google Maps key restriction (com.trotro.os).
# Run from project root: .\scripts\get-android-sha1.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== TrotroOS Android SHA-1 ===" -ForegroundColor Cyan
Write-Host "Package name: com.trotro.os`n"

$whoami = npx eas-cli whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Log in first:  npx eas-cli login`n" -ForegroundColor Yellow
    exit 1
}
Write-Host "Expo account: $whoami`n" -ForegroundColor Green

Write-Host "Opening EAS credentials (interactive)..." -ForegroundColor Yellow
Write-Host @"

In the menu that opens:
  1. Platform: Android
  2. Profile: preview  (or production for Play Store)
  3. Keystore: Manage everything needed to build your project
  4. View credentials

Copy the line:  SHA1 Fingerprint: AA:BB:CC:...

Then in Google Cloud Console → Credentials → your Maps key:
  Application restrictions → Android apps
  Package: com.trotro.os
  SHA-1: (paste)

"@ -ForegroundColor White

npx eas-cli credentials -p android

Write-Host "`nDirect link: https://expo.dev/accounts/mensah-u/projects/TrotroOSv2/credentials`n" -ForegroundColor Cyan
