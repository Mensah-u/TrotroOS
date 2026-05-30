# Opens Supabase SQL Editor with FIX_trip_fare.sql so mate-set fares sync to passengers.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$sqlFile = Join-Path $PWD "supabase\FIX_trip_fare.sql"
$url = "https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new"

Write-Host "`n=== Persist mate fare on live trips ===" -ForegroundColor Cyan
Write-Host "SQL file: $sqlFile`n"
Write-Host "1. Browser opens SQL Editor"
Write-Host "2. Notepad opens FIX_trip_fare.sql — Ctrl+A, Ctrl+C"
Write-Host "3. Paste in SQL Editor → Run"
Write-Host "4. Wait 30 seconds, then Mate: end trip → start new trip with fare`n"

Start-Process $url
Start-Process notepad $sqlFile
