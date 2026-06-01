# Deploy Paystack Edge Functions to Supabase
# Run: .\scripts\deploy-paystack-functions.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "Install Supabase CLI: https://supabase.com/docs/guides/cli" -ForegroundColor Red
    exit 1
}

if (-not $env:PAYSTACK_SECRET_KEY) {
    if (Test-Path ".env") {
        Get-Content ".env" | ForEach-Object {
            if ($_ -match '^PAYSTACK_SECRET_KEY=(.+)$') {
                $env:PAYSTACK_SECRET_KEY = $matches[1].Trim()
            }
        }
    }
}

if (-not $env:PAYSTACK_SECRET_KEY) {
    Write-Host "Set PAYSTACK_SECRET_KEY in .env or env before deploying." -ForegroundColor Yellow
    Write-Host "Example: supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx" -ForegroundColor DarkGray
} else {
    supabase secrets set "PAYSTACK_SECRET_KEY=$($env:PAYSTACK_SECRET_KEY)"
}

Write-Host "Deploying initialize-payment..." -ForegroundColor Cyan
supabase functions deploy initialize-payment

Write-Host "Deploying paystack-webhook (no JWT — Paystack HMAC only)..." -ForegroundColor Cyan
supabase functions deploy paystack-webhook --no-verify-jwt

Write-Host "`nDone. Set Paystack webhook URL to:" -ForegroundColor Green
Write-Host "  https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook"
Write-Host "See docs/supabase/PAYMENTS.md for full setup.`n"
