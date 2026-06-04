# Opens Supabase SQL Editor with FIX_mate_depart_now.sql for "permission denied" on Depart Now.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$sqlFile = Join-Path $PWD "supabase\FIX_mate_depart_now.sql"
$url = "https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new"

Write-Host "`n=== Fix mate Depart Now (permission denied) ===" -ForegroundColor Cyan
Write-Host "SQL file: $sqlFile`n"
Write-Host "1. Browser opens SQL Editor"
Write-Host "2. Notepad opens FIX_mate_depart_now.sql — Ctrl+A, Ctrl+C"
Write-Host "3. Paste in SQL Editor → Run"
Write-Host "4. Wait 30 seconds, then Mate app, Depart Now again`n"

Start-Process $url
Start-Process notepad $sqlFile
