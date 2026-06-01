# Push local .env secrets to EAS (preview + production).
# Run: .\scripts\setup-eas-env.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path ".env")) {
    Write-Host "Missing .env — copy .env.example and fill in keys." -ForegroundColor Red
    exit 1
}

$whoami = npx eas-cli whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Log in first:  npx eas-cli login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Logged in as: $whoami" -ForegroundColor Green
Write-Host "Uploading .env to EAS preview + production...`n"

npx eas-cli env:push preview --path .env --force
npx eas-cli env:push production --path .env --force

Write-Host "`n--- Sentry source maps ---" -ForegroundColor Cyan
Write-Host "For readable stack traces in production builds, add SENTRY_AUTH_TOKEN to EAS secrets:"
Write-Host "  1. Create token: https://sentry.io/settings/account/api/auth-tokens/"
Write-Host "     Scopes: project:releases, org:read"
Write-Host "  2. npx eas-cli env:create --name SENTRY_AUTH_TOKEN --value YOUR_TOKEN --scope project --environment production"
Write-Host "  3. Repeat for preview if needed"
Write-Host ""
Write-Host "Org: trotroos · Project: react-native" -ForegroundColor DarkGray
Write-Host "`nDone. Verify at:" -ForegroundColor Green
Write-Host "https://expo.dev/accounts/mensah-u/projects/TrotroOSv2/environment-variables`n"
