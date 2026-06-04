# Deploy Paystack Edge Functions to Supabase
# Run: .\scripts\deploy-paystack-functions.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    $npxCmd = Get-Command npx.cmd -ErrorAction SilentlyContinue
    $npx = if ($npxCmd) { $npxCmd.Source } else { 'npx' }
    $supabaseCmd = @{ Source = $npx; Args = @('supabase') }
    Write-Host "Using npx supabase (install global CLI for faster deploys)." -ForegroundColor DarkGray
}

function Invoke-Supabase {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CmdArgs)
    if ($supabaseCmd.Args) {
        & $supabaseCmd.Source @($supabaseCmd.Args + $CmdArgs)
    } else {
        & $supabaseCmd.Source @CmdArgs
    }
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
    Invoke-Supabase secrets set "PAYSTACK_SECRET_KEY=$($env:PAYSTACK_SECRET_KEY)"
}

Write-Host "Deploying initialize-payment..." -ForegroundColor Cyan
Invoke-Supabase functions deploy initialize-payment

Write-Host "Deploying initialize-mate-invite-payment..." -ForegroundColor Cyan
Invoke-Supabase functions deploy initialize-mate-invite-payment

Write-Host "Deploying send-push (internal)..." -ForegroundColor Cyan
Invoke-Supabase functions deploy send-push

Write-Host "Deploying request-payout (admin/cron use)..." -ForegroundColor Cyan
Invoke-Supabase functions deploy request-payout

Write-Host "Deploying paystack-webhook (no JWT — Paystack HMAC only)..." -ForegroundColor Cyan
Invoke-Supabase functions deploy paystack-webhook --no-verify-jwt

Write-Host "`nDone. Set Paystack webhook URL to:" -ForegroundColor Green
Write-Host "  https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook"
Write-Host "See docs/supabase/PAYMENTS.md for full setup.`n"
