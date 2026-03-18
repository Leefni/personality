#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue

if (-not $NodeCmd) {
    throw "Node.js is required for frontend syntax checks."
}

$JsFiles = @(
    (Join-Path $RootDir "assets/app.js")
)

$JsFiles += Get-ChildItem (Join-Path $RootDir "assets/js") -Filter "*.js" -File | Sort-Object Name | ForEach-Object { $_.FullName }

foreach ($file in $JsFiles) {
    if (-not (Test-Path $file -PathType Leaf)) {
        throw "Missing JavaScript file: $file"
    }

    & node --check $file
}

Write-Host "Frontend JavaScript syntax check passed for assets/app.js and assets/js/*.js"
