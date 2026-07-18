#!/bin/bash

# ============================================================================
#  Coda Android APK Builder
#  Builds an APK via EAS Build (cloud) for sideloading.
#
#  by @graphicsprocessingunit
# ============================================================================

set -e

# -- Colors ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# -- Derived values ----------------------------------------------------------
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/build"
VERSION=$(node -e "const a=require('$PROJECT_DIR/app.json'); console.log(a.expo.version)" 2>/dev/null || echo "1.0.0")
APK_NAME="Coda-v${VERSION}.apk"
APK_PATH="$BUILD_DIR/$APK_NAME"

POLL_INTERVAL=30
TIMEOUT=1800

# -- Helpers -----------------------------------------------------------------
print_banner() {
    echo ""
    echo -e "${MAGENTA}"
    cat << 'BANNER'

           ______          __
          / ____/___  ____/ /___ _
         / /   / __ \/ __  / __ `/
        / /___/ /_/ / /_/ / /_/ /
        \____/\____/\__,_/\__,_/


BANNER
    echo -e "${RESET}"
    echo -e "${DIM}         ── BUILD YOUR MUSIC ──${RESET}"
    echo ""
    echo -e "${DIM}         by @graphicsprocessingunit${RESET}"
    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo ""
}

step() {
    local num=$1
    local total=$2
    local msg=$3
    echo -e "${CYAN}  [$num/$total]${RESET} ${BOLD}$msg${RESET}"
}

success() {
    echo -e "  ${GREEN}✓${RESET} $1"
}

warn() {
    echo -e "  ${YELLOW}⚠${RESET} $1"
}

fail() {
    echo -e "  ${RED}✗${RESET} $1"
    echo ""
    exit 1
}

# -- Pre-flight checks -------------------------------------------------------
preflight() {
    step 1 4 "Checking prerequisites..."

    if ! command -v eas &>/dev/null; then
        fail "EAS CLI not found. Install with: npm install -g eas-cli"
    fi

    if ! command -v node &>/dev/null; then
        fail "Node.js not found. Install from https://nodejs.org"
    fi

    if ! eas whoami &>/dev/null; then
        fail "Not logged in to EAS. Run: eas login"
    fi

    if [ ! -f "$PROJECT_DIR/eas.json" ]; then
        fail "eas.json not found. Run: eas build:configure"
    fi

    if ! node -e "const e=require('$PROJECT_DIR/eas.json'); if(!e.build['preview-android']) throw 1" 2>/dev/null; then
        fail "preview-android profile not found in eas.json"
    fi

    success "Prerequisites OK"
    echo ""
}

# -- Launch build ------------------------------------------------------------
launch_build() {
    step 2 4 "Launching Android build on EAS Cloud..."

    mkdir -p "$BUILD_DIR"

    local build_output
    build_output=$(cd "$PROJECT_DIR" && eas build --platform android --profile preview-android --non-interactive --json 2>&1) || {
        echo ""
        echo -e "${RED}  EAS Build launch failed:${RESET}"
        echo "$build_output" | head -20
        fail "Build launch failed"
    }

    BUILD_ID=$(echo "$build_output" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log(j.id || j[0]?.id || '')" 2>/dev/null)

    if [ -z "$BUILD_ID" ]; then
        fail "Could not parse build ID from EAS output"
    fi

    success "Build launched (ID: ${BUILD_ID:0:8}...)"
    echo ""
}

# -- Wait for build ----------------------------------------------------------
wait_for_build() {
    step 3 4 "Waiting for build to complete..."

    local elapsed=0
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0

    while [ $elapsed -lt $TIMEOUT ]; do
        local status_output
        status_output=$(cd "$PROJECT_DIR" && eas build:view "$BUILD_ID" --json 2>/dev/null) || true

        local status
        status=$(echo "$status_output" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log(j.status || '')" 2>/dev/null || echo "")

        case "$status" in
            finished)
                printf "\r"
                success "Build finished!"
                echo ""
                return 0
                ;;
            errored|cancelled)
                printf "\r"
                fail "Build $status. Check https://expo.dev for details."
                ;;
            *)
                printf "\r  ${CYAN}%s${RESET} Building... (%ds elapsed)" "${spin:i++%${#spin}:1}" "$elapsed"
                sleep $POLL_INTERVAL
                elapsed=$((elapsed + POLL_INTERVAL))
                ;;
        esac
    done

    printf "\r"
    fail "Build timed out after ${TIMEOUT}s. Check https://expo.dev for status."
}

# -- Download APK ------------------------------------------------------------
download_apk() {
    step 4 4 "Downloading APK..."

    (cd "$PROJECT_DIR" && eas build:download --id "$BUILD_ID" --path "$BUILD_DIR" 2>&1) || {
        fail "Failed to download APK"
    }

    # Find the downloaded file
    local downloaded
    downloaded=$(find "$BUILD_DIR" -name "*.apk" -newer "$BUILD_DIR" -type f 2>/dev/null | head -1)

    if [ -z "$downloaded" ]; then
        fail "APK file not found after download"
    fi

    # Rename to consistent name
    if [ "$downloaded" != "$APK_PATH" ]; then
        mv "$downloaded" "$APK_PATH"
    fi

    if [ ! -f "$APK_PATH" ]; then
        fail "APK file missing at $APK_PATH"
    fi

    local size
    size=$(du -h "$APK_PATH" | cut -f1)

    success "APK downloaded"
    echo ""

    # -- Done! ----------------------------------------------------------------
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo ""
    echo -e "  ${GREEN}${BOLD}  BUILD COMPLETE${RESET}"
    echo ""
    echo -e "  ${BOLD}  Version:${RESET}  $VERSION"
    echo -e "  ${BOLD}  Output:${RESET}   $APK_PATH"
    echo -e "  ${BOLD}  Size:${RESET}     $size"
    echo ""
    echo -e "  ${DIM}  Transfer to your Android device and install.${RESET}"
    echo -e "  ${DIM}  Enable 'Install from unknown sources' if prompted.${RESET}"
    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo -e "  ${DIM}  @graphicsprocessingunit${RESET}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo ""
}

# -- Main --------------------------------------------------------------------
main() {
    print_banner
    preflight
    launch_build
    wait_for_build
    download_apk
}

main "$@"
