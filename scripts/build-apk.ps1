# ============================================================================
#  Coda Android APK Builder (Windows)
#  Builds an APK via EAS Build (cloud) for sideloading.
#
#  by @graphicsprocessingunit
# ============================================================================

[CmdletBinding()]
param(
    [string]$Id,
    [switch]$NoDownload,
    [switch]$Open,
    [int]$Timeout = 3600,
    [Alias('Profile')]
    [string]$BuildProfile = 'preview-android',
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

$PollInterval = 15
$FallbackEstimate = 1200

if ($Help) {
    Write-Host ""
    Write-Host "  Coda Android APK builder" -ForegroundColor White
    Write-Host ""
    Write-Host "  Usage: .\scripts\build-apk.ps1 [options]" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Options:"
    Write-Host "    -Id <build-id>      Attach to an existing build instead of launching a new one"
    Write-Host "    -NoDownload         Wait for the build but don't download the APK"
    Write-Host "    -Open               Open the build page in your browser"
    Write-Host "    -Timeout <seconds>  Stop watching after N seconds (default 3600, 0 = wait forever)"
    Write-Host "    -Profile <name>     EAS build profile (default preview-android)"
    Write-Host "    -Help               Show this help"
    Write-Host ""
    exit 0
}

# -- Output helpers -----------------------------------------------------------
function Write-Step {
    param([string]$Num, [string]$Total, [string]$Msg)
    Write-Host "  [$Num/$Total] " -ForegroundColor Cyan -NoNewline
    Write-Host $Msg -ForegroundColor White
}
function Write-Success { param([string]$Msg) Write-Host "  " -NoNewline; Write-Host "✓" -ForegroundColor Green -NoNewline; Write-Host " $Msg" }
function Write-Warn    { param([string]$Msg) Write-Host "  " -NoNewline; Write-Host "⚠" -ForegroundColor Yellow -NoNewline; Write-Host " $Msg" }
function Write-Fail    { param([string]$Msg) Write-Host "  " -NoNewline; Write-Host "✗" -ForegroundColor Red -NoNewline; Write-Host " $Msg"; exit 1 }

function Clear-Line {
    param([bool]$IsTty)
    if ($IsTty) { Write-Host "`r$(' ' * 110)`r" -NoNewline }
}

# -- Value helpers ------------------------------------------------------------
$ProjectDir = Split-Path $PSScriptRoot -Parent
$BuildDir   = Join-Path $ProjectDir "build"
$AppJsonPath = Join-Path $ProjectDir "app.json"
$AppJson    = Get-Content $AppJsonPath -Raw | ConvertFrom-Json
$Version    = $AppJson.expo.version
if (-not $Version) { $Version = "1.0.0" }
$ApkName    = "Coda-v$Version.apk"
$ApkPath    = Join-Path $BuildDir $ApkName
$StatePath  = Join-Path $BuildDir "last-build.txt"

function Get-Field {
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) { return $null }
    return $prop.Value
}

function Get-Epoch {
    param($Value)
    if (-not $Value) { return $null }
    try {
        return [int][DateTimeOffset]::Parse(
            [string]$Value,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::AssumeUniversal
        ).ToUnixTimeSeconds()
    } catch {
        return $null
    }
}

function Format-Duration {
    param([int]$Seconds)
    if ($Seconds -lt 0) { $Seconds = 0 }
    $h = [math]::Floor($Seconds / 3600)
    $m = [math]::Floor(($Seconds % 3600) / 60)
    $s = $Seconds % 60
    if ($h -gt 0) { return "{0}h {1:00}m" -f $h, $m }
    if ($m -gt 0) { return "{0}m {1:00}s" -f $m, $s }
    return "${s}s"
}

function Format-Status {
    param([string]$Status)
    switch ($Status.ToUpper()) {
        'NEW'         { return 'requested' }
        'IN_QUEUE'    { return 'in queue' }
        'IN_PROGRESS' { return 'building' }
        'FINISHED'    { return 'finished' }
        'ERRORED'     { return 'errored' }
        'CANCELED'    { return 'cancelled' }
        'CANCELLED'   { return 'cancelled' }
        default {
            if (-not $Status) { return 'unknown' }
            return (($Status -replace '[_-]', ' ').ToLower())
        }
    }
}

function Get-Estimate {
    param([string]$ProfileName)
    $script:EstimateIsFallback = $true
    try {
        $raw = & eas build:list --platform android --limit 8 --json 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $raw) { return $FallbackEstimate }
        $list = ($raw -join "`n") | ConvertFrom-Json
    } catch {
        return $FallbackEstimate
    }

    $times = @()
    foreach ($build in @($list)) {
        if ((Get-Field $build 'status') -ne 'FINISHED') { continue }
        if ($ProfileName -and (Get-Field $build 'buildProfile') -and (Get-Field $build 'buildProfile') -ne $ProfileName) { continue }
        $created = Get-Epoch (Get-Field $build 'createdAt')
        $done    = Get-Epoch (Get-Field $build 'completedAt')
        if (-not $created -or -not $done) { continue }
        $seconds = $done - $created
        if ($seconds -gt 60) { $times += [int]$seconds }
    }

    if ($times.Count -eq 0) { return $FallbackEstimate }
    $sorted = @($times | Sort-Object)
    $script:EstimateIsFallback = $false
    return [int]$sorted[[math]::Floor($sorted.Count / 2)]
}

function Get-BuildUrl {
    param([string]$BuildId)
    $owner = $AppJson.expo.owner
    $slug  = $AppJson.expo.slug
    if (-not $owner) {
        $owner = & eas whoami 2>$null | Select-Object -First 1
    }
    if ($owner -and $slug -and $BuildId) {
        return "https://expo.dev/accounts/$owner/projects/$slug/builds/$BuildId"
    }
    return "https://expo.dev/accounts/$owner/apps/$slug/builds"
}

# -- Banner -------------------------------------------------------------------
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

# -- Pre-flight ---------------------------------------------------------------
function Test-Prerequisites {
    Write-Step 1 4 "Checking prerequisites..."

    if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
        Write-Fail "EAS CLI not found. Install with: npm install -g eas-cli"
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Fail "Node.js not found. Install from https://nodejs.org"
    }

    $who = & eas whoami 2>$null | Select-Object -First 1
    if (-not $who) {
        Write-Fail "Not logged in to EAS. Run: eas login"
    }

    $easJsonPath = Join-Path $ProjectDir "eas.json"
    if (-not (Test-Path $easJsonPath)) {
        Write-Fail "eas.json not found. Run: eas build:configure"
    }

    $easJson = Get-Content $easJsonPath -Raw | ConvertFrom-Json
    if (-not $easJson.build.PSObject.Properties[$BuildProfile]) {
        Write-Fail "$BuildProfile profile not found in eas.json"
    }

    Write-Success "Prerequisites OK (account: $($who.Trim()), profile: $BuildProfile)"
    Write-Host ""
}

# -- Launch / attach ----------------------------------------------------------
function Start-Build {
    Write-Host ""
    Write-Step 2 4 "Launching Android build on EAS Cloud..."

    if (-not (Test-Path $BuildDir)) {
        New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
    }

    $parsed = $null

    if ($Id) {
        $view = & eas build:view $Id --json 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $view) {
            Write-Fail "Could not load build $Id. Check the ID with: eas build:list"
        }
        try { $parsed = ($view -join "`n") | ConvertFrom-Json } catch { Write-Fail "Could not parse build $Id" }
        $script:BuildId = $Id
        Write-Success "Attaching to build $($Id.Substring(0, [math]::Min(8, $Id.Length)))"
    } else {
        $logPath = Join-Path $BuildDir "eas-launch.log"
        $raw = & eas build --platform android --profile $BuildProfile --non-interactive --json 2> $logPath
        if ($LASTEXITCODE -ne 0 -or -not $raw) {
            Write-Host ""
            Write-Host "  EAS Build launch failed. Last lines of build\eas-launch.log:" -ForegroundColor Red
            if (Test-Path $logPath) {
                Get-Content $logPath -Tail 20 | ForEach-Object { Write-Host "  $_" }
            }
            Write-Fail "Build launch failed"
        }
        try { $parsed = ($raw -join "`n") | ConvertFrom-Json } catch { Write-Fail "Could not parse EAS build output" }
        if ($parsed -is [Array]) { $parsed = $parsed[0] }
        $script:BuildId = Get-Field $parsed 'id'
        if (-not $script:BuildId) { Write-Fail "Could not parse build ID from EAS output" }
        Write-Success "Build launched ($($script:BuildId.Substring(0, [math]::Min(8, $script:BuildId.Length))))"
    }

    $script:CreatedAt = Get-Field $parsed 'createdAt'
    $script:CreatedEpoch = Get-Epoch $script:CreatedAt
    $script:BuildUrl = Get-BuildUrl $script:BuildId
    $script:Estimate = Get-Estimate $BuildProfile

    Write-Host ""
    Write-Host "  Build page: " -ForegroundColor White -NoNewline
    Write-Host $script:BuildUrl -ForegroundColor Cyan
    Write-Host "  Open this to watch the live logs or share the build." -ForegroundColor DarkGray
    Write-Host ""

    $eta = Format-Duration $script:Estimate
    if ($script:EstimateIsFallback) {
        Write-Host "  Rough estimate: ~$eta (no recent Android builds found)." -ForegroundColor DarkGray
    } else {
        Write-Host "  Typical build time from your recent builds: ~$eta" -ForegroundColor DarkGray
    }
    Write-Host ""

    try {
        "id=$($script:BuildId)`nurl=$($script:BuildUrl)`ncreated=$($script:CreatedAt)" |
            Set-Content -Path $StatePath -Encoding ASCII
    } catch {
        Write-Warn "Could not save build state to $StatePath"
    }

    if ($Open) {
        try { Start-Process $script:BuildUrl } catch { Write-Warn "Could not open the browser" }
    }
}

# -- Wait ---------------------------------------------------------------------
function Wait-Build {
    Write-Host ""
    Write-Step 3 4 "Waiting for build to complete..."
    Write-Host "  Ctrl-C stops watching only — the build keeps running in the cloud." -ForegroundColor DarkGray
    Write-Host ""

    $spin = @('-', '\', '|', '/')
    $spinIndex = 0
    $prevLine = ''
    $isTty = -not [Console]::IsOutputRedirected

    while ($true) {
        $info = $null
        $raw = & eas build:view $script:BuildId --json 2>$null
        if ($LASTEXITCODE -eq 0 -and $raw) {
            try { $info = ($raw -join "`n") | ConvertFrom-Json } catch { $info = $null }
        }

        $status = [string](Get-Field $info 'status')
        $upper = $status.ToUpper()

        if ($upper -eq 'FINISHED') {
            Clear-Line $isTty
            $created = Get-Epoch (Get-Field $info 'createdAt')
            if (-not $created) { $created = $script:CreatedEpoch }
            $completed = Get-Epoch (Get-Field $info 'completedAt')
            if ($created -and $completed -and $completed -ge $created) {
                $duration = [int]($completed - $created)
            } elseif ($created) {
                $duration = [int]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - $created)
            } else {
                $duration = 0
            }
            Write-Success "Build finished in $(Format-Duration $duration)"
            Write-Host ""
            $script:BuildDone = $true
            return
        }

        if ($upper -eq 'ERRORED' -or $upper -eq 'CANCELED' -or $upper -eq 'CANCELLED') {
            Clear-Line $isTty
            $script:BuildDone = $true
            $detail = Get-Field (Get-Field $info 'error') 'message'
            Write-Host ""
            if ($detail) { Write-Host "  $detail" -ForegroundColor Red }
            Write-Host "  Build page: " -NoNewline; Write-Host $script:BuildUrl -ForegroundColor Cyan
            Write-Host ""
            Write-Fail "Build $(Format-Status $upper). The logs above the failure on the build page explain why."
        }

        $created = Get-Epoch (Get-Field $info 'createdAt')
        if (-not $created) { $created = $script:CreatedEpoch }
        if ($created) {
            $elapsed = [int]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - $created)
        } else {
            $elapsed = 0
        }
        if ($elapsed -lt 0) { $elapsed = 0 }

        $pct = [int][math]::Min(99, [math]::Round(($elapsed / [double]$script:Estimate) * 100))
        if ($pct -lt 0) { $pct = 0 }
        $filled = [int][math]::Round($pct / 5)
        $bar = ('#' * $filled) + ('-' * (20 - $filled))
        $remaining = [int][math]::Max(0, $script:Estimate - $elapsed)

        $line = "  $($spin[$spinIndex % $spin.Count]) $(Format-Status $upper)  $bar  $pct%  $(Format-Duration $elapsed) elapsed · ~$(Format-Duration $remaining) left"
        if ($isTty) {
            Write-Host "`r$line" -NoNewline -ForegroundColor Cyan
        } elseif ($line -ne $prevLine) {
            Write-Host $line
        }
        $prevLine = $line
        $spinIndex++

        if ($Timeout -gt 0 -and $elapsed -ge $Timeout) {
            Clear-Line $isTty
            Write-Host ""
            Write-Host "  Build page: " -NoNewline; Write-Host $script:BuildUrl -ForegroundColor Cyan
            Write-Fail ("Stopped watching after $(Format-Duration $elapsed); the build is still running. " +
                "Reattach with: .\scripts\build-apk.ps1 -Id $($script:BuildId)")
        }

        Start-Sleep -Seconds $PollInterval
    }
}

# -- Download -----------------------------------------------------------------
function Get-APK {
    Write-Host ""
    Write-Step 4 4 "Downloading APK..."

    & eas build:download --id $script:BuildId --path $BuildDir 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Failed to download APK. Retry with: eas build:download --id $($script:BuildId) --path build\"
    }

    $downloaded = Get-ChildItem -Path $BuildDir -Filter "*.apk" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $downloaded) {
        Write-Fail "APK file not found after download"
    }

    if ($downloaded.FullName -ne $ApkPath) {
        Move-Item $downloaded.FullName $ApkPath -Force
    }

    if (-not (Test-Path $ApkPath)) {
        Write-Fail "APK file missing at $ApkPath"
    }

    Write-Success "APK downloaded"
}

# -- Summary ------------------------------------------------------------------
function Write-Summary {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  BUILD COMPLETE" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Version:   " -NoNewline; Write-Host $Version
    Write-Host "  Build page: " -NoNewline; Write-Host $script:BuildUrl -ForegroundColor Cyan

    if (Test-Path $ApkPath) {
        $size = "{0:N1} MB" -f ((Get-Item $ApkPath).Length / 1MB)
        $sha = (Get-FileHash -Path $ApkPath -Algorithm SHA256).Hash.ToLower()
        Write-Host "  Output:    " -NoNewline; Write-Host $ApkPath
        Write-Host "  Size:      " -NoNewline; Write-Host $size
        Write-Host "  SHA-256:   " -NoNewline; Write-Host $sha
        Write-Host ""
        Write-Host "  Install over USB:  adb install -r `"$ApkPath`"" -ForegroundColor DarkGray
        Write-Host "  Or copy the APK to your device and open it, allowing install from unknown sources." -ForegroundColor DarkGray
    } else {
        Write-Host ""
        Write-Host "  Download it later with:" -ForegroundColor DarkGray
        Write-Host "  eas build:download --id $($script:BuildId) --path build\" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
}

# -- Main ---------------------------------------------------------------------
$script:BuildId = $null
$script:BuildUrl = $null
$script:CreatedAt = $null
$script:CreatedEpoch = $null
$script:Estimate = $FallbackEstimate
$script:EstimateIsFallback = $true
$script:BuildDone = $false

try {
    Write-Banner
    Test-Prerequisites
    Start-Build
    Wait-Build

    if (-not $NoDownload) {
        Get-APK
    } else {
        Write-Host ""
        Write-Warn "Skipping download (-NoDownload)."
    }

    Write-Summary
    $script:BuildDone = $true
} finally {
    if (-not $script:BuildDone -and $script:BuildUrl) {
        Write-Host ""
        Write-Host "  The build is still running in the cloud." -ForegroundColor Yellow
        Write-Host "  Build page: " -NoNewline; Write-Host $script:BuildUrl -ForegroundColor Cyan
        Write-Host "  Reattach with: .\scripts\build-apk.ps1 -Id $($script:BuildId) -NoDownload" -ForegroundColor DarkGray
        Write-Host ""
    }
}
