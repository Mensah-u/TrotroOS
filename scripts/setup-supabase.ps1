# Opens Supabase SQL Editor and shows where RUN_THIS_FIRST.sql lives.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$sqlFile = Join-Path $PWD "supabase\RUN_THIS_FIRST.sql"
$url = "https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new"

Write-Host "`n=== TrotroOS Supabase setup ===" -ForegroundColor Cyan
Write-Host "SQL file: $sqlFile`n"
Write-Host "1. Open SQL Editor (browser will open)"
Write-Host "2. Open RUN_THIS_FIRST.sql in Notepad, select all, copy"
Write-Host "3. Paste into SQL Editor and click Run"
Write-Host "4. Wait 1 minute, then retry mate sign-up in the app`n"

Start-Process $url
notepad $sqlFile
