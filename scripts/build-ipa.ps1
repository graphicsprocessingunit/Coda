# ============================================================================
#  Coda iOS IPA Builder (Windows)
#  iOS builds require macOS with Xcode installed.
#  This script provides guidance for Windows users.
#
#  by @graphicsprocessingunit
# ============================================================================

$ErrorActionPreference = "Stop"

# -- Colors ------------------------------------------------------------------
function Write-Success { param($Msg) Write-Host "  " -NoNewline; Write-Host "✓" -ForegroundColor Green -NoNewline; Write-Host " $Msg" }
function Write-Fail    { param($Msg) Write-Host "  " -NoNewline; Write-Host "✗" -ForegroundColor Red -NoNewline; Write-Host " $Msg" }

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
Write-Host "     Run the bash script instead:" -ForegroundColor DarkGray
Write-Host "     ./scripts/build-ipa.sh" -ForegroundColor White
Write-Host ""
Write-Host "  2. " -ForegroundColor Cyan -NoNewline; Write-Host "Use a CI/CD service" -ForegroundColor White
Write-Host "     GitHub Actions with macos-latest runner can build the IPA." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  3. " -ForegroundColor Cyan -NoNewline; Write-Host "Use EAS Build" -ForegroundColor White
Write-Host "     eas build --platform ios --profile production" -ForegroundColor DarkGray
Write-Host "     (Requires Apple Developer account)" -ForegroundColor DarkGray
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  @graphicsprocessingunit" -ForegroundColor DarkGray
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""
