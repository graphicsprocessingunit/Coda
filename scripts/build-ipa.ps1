# ============================================================================
#  Coda iOS IPA Builder (Windows)
#  iOS builds require macOS with Xcode installed.
#  This script explains the options available from Windows.
#
#  by @graphicsprocessingunit
# ============================================================================

[CmdletBinding()]
param(
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host ""
    Write-Host "  Coda iOS IPA builder" -ForegroundColor White
    Write-Host ""
    Write-Host "  iOS builds need macOS with Xcode, so this script only outlines your options on" -ForegroundColor DarkGray
    Write-Host "  Windows. On a Mac, run scripts/build-ipa.sh, which supports:" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "    --clean   wipe build\ before archiving (older IPAs are kept otherwise)"
    Write-Host "    --open    reveal the finished IPA in Finder"
    Write-Host "    -h        show usage"
    Write-Host ""
    Write-Host "  Options:" -ForegroundColor White
    Write-Host "    -Help     Show this help"
    Write-Host ""
    exit 0
}

# -- Banner ------------------------------------------------------------------
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

# -- macOS check -------------------------------------------------------------
Write-Host "  iOS builds require macOS with Xcode." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Options:" -ForegroundColor White
Write-Host ""
Write-Host "  1. " -ForegroundColor Cyan -NoNewline; Write-Host "Build on a Mac" -ForegroundColor White
Write-Host "     Run the bash script instead (it archives in Xcode, times the build, and" -ForegroundColor DarkGray
Write-Host "     prints a SHA-256 of the IPA):" -ForegroundColor DarkGray
Write-Host "     ./scripts/build-ipa.sh" -ForegroundColor White
Write-Host "     Or from npm: npm run build:ios" -ForegroundColor White
Write-Host ""
Write-Host "  2. " -ForegroundColor Cyan -NoNewline; Write-Host "Use a CI/CD service" -ForegroundColor White
Write-Host "     GitHub Actions with a macos-latest runner can archive and export the IPA." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  3. " -ForegroundColor Cyan -NoNewline; Write-Host "Use EAS Build" -ForegroundColor White
Write-Host "     eas build --platform ios --profile production" -ForegroundColor DarkGray
Write-Host "     (Requires an Apple Developer account; this project's EAS iOS credentials" -ForegroundColor DarkGray
Write-Host "     are not configured, so releases are built locally in Xcode.)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Tip: .\scripts\build-apk.ps1 -Help lists the Android builder's options." -ForegroundColor DarkGray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  @graphicsprocessingunit" -ForegroundColor DarkGray
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""
