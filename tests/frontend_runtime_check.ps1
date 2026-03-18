#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue

if (-not $NodeCmd) {
    throw "Node.js is required for frontend runtime checks."
}

& node (Join-Path $RootDir "tests/frontend_runtime_flow_test.mjs") "case_a"
& node (Join-Path $RootDir "tests/frontend_runtime_flow_test.mjs") "case_b"
& node (Join-Path $RootDir "tests/frontend_runtime_flow_test.mjs") "case_c"
& node (Join-Path $RootDir "tests/frontend_runtime_flow_test.mjs") "case_timeout"

Write-Host "Frontend runtime behavior checks passed for load flow edge cases"
