# Download the latest successful TrotroOS APK to your Downloads folder.
Set-Location $PSScriptRoot\..

Write-Host "`nFetching latest Android build..." -ForegroundColor Cyan

$json = npx eas-cli build:list --platform android --status finished --limit 1 --json 2>&1 | Out-String
$builds = $json | ConvertFrom-Json
$apkUrl = $builds[0].artifacts.applicationArchiveUrl

if (-not $apkUrl) {
    Write-Host "No finished APK build found. Run .\scripts\build-apk.ps1 first." -ForegroundColor Red
    exit 1
}

$out = Join-Path $env:USERPROFILE "Downloads\TrotroOS.apk"
Write-Host "Downloading from: $apkUrl" -ForegroundColor Gray
Write-Host "Saving to: $out`n" -ForegroundColor Gray

Invoke-WebRequest -Uri $apkUrl -OutFile $out -UseBasicParsing

Write-Host "Done! APK saved to:" -ForegroundColor Green
Write-Host $out
Write-Host "`nCopy to your phone and install (enable unknown sources).`n"
