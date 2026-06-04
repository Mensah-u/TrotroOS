# Opens Supabase SQL Editor with FIX_baseline_rls_policies.sql
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$sqlFile = Join-Path $PWD "supabase\FIX_baseline_rls_policies.sql"
$url = "https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new"

Write-Host ""
Write-Host "=== TrotroOS baseline RLS policies ===" -ForegroundColor Cyan
Write-Host "SQL file: $sqlFile"
Write-Host ""
Write-Host "1. Browser opens Supabase SQL Editor"
Write-Host "2. Notepad opens the SQL file - Ctrl+A, Ctrl+C, paste, Run"
Write-Host "3. Settings -> API -> Reload schema (or wait ~60s)"
Write-Host "4. Test: passenger reserve, mate depart, push token, rating"
Write-Host ""

Start-Process $url
Start-Process notepad $sqlFile
