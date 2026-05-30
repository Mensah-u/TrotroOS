# Opens Supabase SQL Editor with FIX_security_hardening.sql for Security Advisor warnings.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$sqlFile = Join-Path $PWD "supabase\FIX_security_hardening.sql"
$url = "https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new"

Write-Host "`n=== TrotroOS security hardening ===" -ForegroundColor Cyan
Write-Host "SQL file: $sqlFile`n"
Write-Host "1. Deploy latest app (x-device-id header in supabase.js)"
Write-Host "2. Browser opens SQL Editor"
Write-Host "3. Notepad opens FIX_security_hardening.sql — Ctrl+A, Ctrl+C"
Write-Host "4. Paste in SQL Editor, Run"
Write-Host "5. Settings -> API -> Reload schema (or wait 60s)"
Write-Host "6. Security Advisor -> refresh warnings`n"

Start-Process $url
Start-Process notepad $sqlFile
