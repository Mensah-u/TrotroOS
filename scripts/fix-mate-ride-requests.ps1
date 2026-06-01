# Opens Supabase SQL Editor with FIX_mate_ride_requests.sql
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$sqlFile = Join-Path $PWD "supabase\FIX_mate_ride_requests.sql"
$url = "https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new"

Write-Host "`n=== Mate ride requests (invite waiting passengers) ===" -ForegroundColor Cyan
Write-Host "SQL file: $sqlFile`n"
Write-Host "1. Browser opens SQL Editor"
Write-Host "2. Notepad opens FIX_mate_ride_requests.sql — Ctrl+A, Ctrl+C"
Write-Host "3. Paste in SQL Editor → Run"
Write-Host "4. Wait 30 seconds, reload Mate + Passenger apps`n"

Start-Process $url
Start-Process notepad $sqlFile
