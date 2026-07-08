# Autonomous build loop for Victor HQ (loop-engineering style).
# Runs one fresh Claude (Sonnet 5) iteration per plan step until done or blocked.
# Rollout levels: -ReportOnly (L1, no edits) -> default (L2, acceptEdits) -> -Unattended (L3, skip permissions).
# Usage: powershell -ExecutionPolicy Bypass -File scripts\build-loop.ps1 [-MaxIterations 30] [-ReportOnly] [-Unattended]

param(
    [int]$MaxIterations = 30,
    [string]$Model = "claude-sonnet-5",
    [switch]$ReportOnly,
    [switch]$Unattended
)

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$promptPath = Join-Path $repo "docs\LOOP-PROMPT.md"
if (-not (Test-Path $promptPath)) {
    Write-Error "Missing docs\LOOP-PROMPT.md"
    exit 1
}
$prompt = Get-Content $promptPath -Raw

if ($ReportOnly) {
    $prompt = "L1 REPORT-ONLY MODE: make NO edits and NO commits. Instead, analyze the next unchecked step and print a detailed implementation report (files, changes, risks). Then stop.`n`n" + $prompt
    $MaxIterations = 1
}

$permArgs = @("--permission-mode", "acceptEdits")
if ($Unattended) { $permArgs = @("--dangerously-skip-permissions") }

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host "`n=== Loop iteration $i / $MaxIterations ($(Get-Date -Format 'HH:mm:ss')) ===" -ForegroundColor Cyan

    $out = claude -p $prompt --model $Model @permArgs
    Write-Host $out

    if ($out -match 'ALL_STEPS_COMPLETE') {
        Write-Host "`nAll steps complete." -ForegroundColor Green
        exit 0
    }
    if ($out -match 'BLOCKED') {
        Write-Host "`nLoop blocked — see docs\BUILD-PROGRESS.md Blockers section." -ForegroundColor Yellow
        exit 2
    }
}

if (-not $ReportOnly) {
    Write-Host "`nMax iterations reached without completion — check docs\BUILD-PROGRESS.md." -ForegroundColor Yellow
    exit 3
}
