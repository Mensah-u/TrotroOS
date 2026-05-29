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
Write-Host "Waiting for build to finish — download the APK from the link below (do not wait for emulator install).`n"

$buildJson = npx eas-cli build --platform android --profile preview --non-interactive --wait --json 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBuild failed. See errors above." -ForegroundColor Red
    exit 1
}

try {
    $build = $buildJson | ConvertFrom-Json
    $url = $build.artifacts.applicationArchiveUrl
    if ($url) {
        Write-Host "`nBuild finished!" -ForegroundColor Green
        Write-Host "Download APK: $url" -ForegroundColor White
        Write-Host "Open that link on your Android phone in Chrome, then tap Download.`n"
    } else {
        Write-Host "`nBuild finished. Open https://expo.dev/accounts/mensah-u/projects/TrotroOSv2/builds for the download link.`n" -ForegroundColor Green
    }
} catch {
    Write-Host "`nBuild finished. Check https://expo.dev for your APK download link.`n" -ForegroundColor Green
}
