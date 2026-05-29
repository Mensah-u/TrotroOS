# Build installable TrotroOS APK via Expo EAS (cloud build).
# Run from project root: .\scripts\build-apk.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== TrotroOS APK Build ===" -ForegroundColor Cyan
Write-Host "Project: $PWD`n"

# Check EAS login
$whoami = npx eas-cli whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "You are not logged in to Expo." -ForegroundColor Yellow
    Write-Host "Run:  npx eas-cli login" -ForegroundColor White
    Write-Host "Then run this script again.`n"
    exit 1
}
Write-Host "Logged in as: $whoami" -ForegroundColor Green

# Link EAS project if needed
$appJsonRaw = Get-Content "app.json" -Raw | ConvertFrom-Json
$projectId = $appJsonRaw.expo.extra.eas.projectId
if (-not $projectId) {
    Write-Host "`nLinking EAS project (one-time setup)..." -ForegroundColor Yellow
    npx eas-cli init --non-interactive
    if ($LASTEXITCODE -ne 0) {
        Write-Host "EAS init failed. Try: npx eas-cli init" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`nStarting cloud APK build (preview profile)..." -ForegroundColor Cyan
Write-Host "This takes ~10-20 minutes. You will get a download link when done.`n"

npx eas-cli build --platform android --profile preview --non-interactive

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild finished! Download your APK from the link above (open on your phone)." -ForegroundColor Green
    Write-Host "Do NOT wait for 'Downloading app' in the terminal — that tries to push to an emulator and often hangs.`n"
    Write-Host "Direct install: open the build page in Chrome on your Android phone, tap Download.`n"
} else {
    Write-Host "`nBuild failed. See errors above." -ForegroundColor Red
    exit 1
}
