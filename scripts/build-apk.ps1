# ============================================================================
#  Coda Android APK Builder (Windows)
#  Builds an APK via EAS Build (cloud) for sideloading.
#
#  by @graphicsprocessingunit
# ============================================================================

$ErrorActionPreference = "Stop"

# -- Colors ------------------------------------------------------------------
function Write-Step    { param($Num, $Total, $Msg) Write-Host "  [$Num/$Total] " -ForegroundColor Cyan -NoNewline; Write-Host $Msg -ForegroundColor White -NoNewline }
function Write-Success { param($Msg) Write-Host "  " -NoNewline; Write-Host "✓" -ForegroundColor Green -NoNewline; Write-Host " $Msg" }
function Write-Warn    { param($Msg) Write-Host "  " -NoNewline; Write-Host "⚠" -ForegroundColor Yellow -NoNewline; Write-Host " $Msg" }
function Write-Fail    { param($Msg) Write-Host "  " -NoNewline; Write-Host "✗" -ForegroundColor Red -NoNewline; Write-Host " $Msg"; exit 1 }

# -- Derived values ----------------------------------------------------------
$ProjectDir = Split-Path $PSScriptRoot -Parent
$BuildDir   = Join-Path $ProjectDir "build"
$AppJson    = Get-Content (Join-Path $ProjectDir "app.json") | ConvertFrom-Json
$Version    = $AppJson.expo.version
if (-not $Version) { $Version = "1.0.0" }
$ApkName    = "Coda-v$Version.apk"
$ApkPath    = Join-Path $BuildDir $ApkName

$POLL_INTERVAL = 30
$TIMEOUT       = 1800

# -- Banner ------------------------------------------------------------------
function Write-Banner {
    Write-Host ""
    Write-Host ""
    Write-Host "           ______          __" -ForegroundColor Magenta
    Write-Host "          / ____/___  ____/ /___ _" -ForegroundColor Magenta
    Write-Host "         / /   / __ \/ __  / __ ``/" -ForegroundColor Magenta
    Write-Host "        / /___/ /_/ / /_/ / /_/ /" -ForegroundColor Magenta
    Write-Host "        \____/\____/\__,_/\__,_/" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "         ── BUILD YOUR MUSIC ──" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "         by @graphicsprocessingunit" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
}

# -- Pre-flight --------------------------------------------------------------
function Test-Prerequisites {
    Write-Step 1 4 "Checking prerequisites..."

    if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
        Write-Fail "EAS CLI not found. Install with: npm install -g eas-cli"
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Fail "Node.js not found. Install from https://nodejs.org"
    }

    $whoami = eas whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Not logged in to EAS. Run: eas login"
    }

    $easJsonPath = Join-Path $ProjectDir "eas.json"
    if (-not (Test-Path $easJsonPath)) {
        Write-Fail "eas.json not found. Run: eas build:configure"
    }

    $easJson = Get-Content $easJsonPath | ConvertFrom-Json
    if (-not $easJson.build.'preview-android') {
        Write-Fail "preview-android profile not found in eas.json"
    }

    Write-Success "Prerequisites OK"
    Write-Host ""
}

# -- Launch build ------------------------------------------------------------
function Start-Build {
    Write-Step 2 4 "Launching Android build on EAS Cloud..."

    if (-not (Test-Path $BuildDir)) { New-Item -ItemType Directory -Path $BuildDir | Out-Null }

    $buildOutput = eas build --platform android --profile preview-android --non-interactive --json 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  EAS Build launch failed:" -ForegroundColor Red
        $buildOutput | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
        Write-Fail "Build launch failed"
    }

    $parsed = $buildOutput | ConvertFrom-Json
    if ($parsed -is [Array]) { $parsed = $parsed[0] }
    $script:BuildId = $parsed.id

    if (-not $script:BuildId) {
        Write-Fail "Could not parse build ID from EAS output"
    }

    Write-Success "Build launched (ID: $($script:BuildId.Substring(0,8))...)"
    Write-Host ""
}

# -- Wait for build ----------------------------------------------------------
function Wait-Build {
    Write-Step 3 4 "Waiting for build to complete..."

    $elapsed = 0
    $spinChars = @('⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏')
    $spinIdx = 0

    while ($elapsed -lt $TIMEOUT) {
        $statusOutput = eas build:view $script:BuildId --json 2>$null
        if ($LASTEXITCODE -eq 0) {
            $statusParsed = $statusOutput | ConvertFrom-Json
            $status = $statusParsed.status

            if ($status -eq "finished") {
                Write-Host "`r" -NoNewline
                Write-Success "Build finished!"
                Write-Host ""
                return
            }
            if ($status -eq "errored" -or $status -eq "cancelled") {
                Write-Host "`r" -NoNewline
                Write-Fail "Build $status. Check https://expo.dev for details."
            }
        }

        Write-Host "`r  $($spinChars[$spinIdx % $spinChars.Length]) Building... ($($elapsed)s elapsed) " -ForegroundColor Cyan -NoNewline
        $spinIdx++
        Start-Sleep -Seconds $POLL_INTERVAL
        $elapsed += $POLL_INTERVAL
    }

    Write-Host "`r" -NoNewline
    Write-Fail "Build timed out after $($TIMEOUT)s. Check https://expo.dev for status."
}

# -- Download APK ------------------------------------------------------------
function Get-APK {
    Write-Step 4 4 "Downloading APK..."

    eas build:download --id $script:BuildId --path $BuildDir 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Failed to download APK"
    }

    $downloaded = Get-ChildItem -Path $BuildDir -Filter "*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $downloaded) {
        Write-Fail "APK file not found after download"
    }

    if ($downloaded.FullName -ne $ApkPath) {
        Move-Item $downloaded.FullName $ApkPath -Force
    }

    if (-not (Test-Path $ApkPath)) {
        Write-Fail "APK file missing at $ApkPath"
    }

    $size = "{0:N1} MB" -f ((Get-Item $ApkPath).Length / 1MB)

    Write-Success "APK downloaded"
    Write-Host ""

    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  BUILD COMPLETE" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Version:  " -ForegroundColor White -NoNewline; Write-Host $Version
    Write-Host "  Output:   " -ForegroundColor White -NoNewline; Write-Host $ApkPath
    Write-Host "  Size:     " -ForegroundColor White -NoNewline; Write-Host $size
    Write-Host ""
    Write-Host "  Transfer to your Android device and install." -ForegroundColor DarkGray
    Write-Host "  Enable 'Install from unknown sources' if prompted." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "  @graphicsprocessingunit" -ForegroundColor DarkGray
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
}

# -- Main --------------------------------------------------------------------
Write-Banner
Test-Prerequisites
Start-Build
Wait-Build
Get-APK
