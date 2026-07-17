#!/bin/bash

# ============================================================================
#  Coda iOS IPA Builder
#  Builds a signed IPA for sideloading via AltStore, SideStore, etc.
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
IOS_DIR="$PROJECT_DIR/ios"
WORKSPACE="$IOS_DIR/Coda.xcworkspace"
SCHEME="Coda"
BUILD_DIR="$PROJECT_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/Coda.xcarchive"
EXPORT_OPTIONS_PLIST="$BUILD_DIR/ExportOptions.plist"
APP_NAME="Coda"

# Read version from app.json
VERSION=$(node -e "const a=require('$PROJECT_DIR/app.json'); console.log(a.expo.version)" 2>/dev/null || echo "1.0.0")
IPA_NAME="Coda-v${VERSION}.ipa"
IPA_PATH="$BUILD_DIR/$IPA_NAME"

# -- Helpers -----------------------------------------------------------------
print_banner() {
    echo ""
    echo -e "${MAGENTA}"
    cat << 'BANNER'

      ██████╗ ██████╗  ██████╗ ██████╗  ██████╗
     ██╔════╝██╔═══██╗██╔═══██╗██╔══██╗██╔════╝
     ██║     ██║   ██║██║   ██║██║  ██║██║
     ██║     ██║   ██║██║   ██║██║  ██║██║
     ╚██████╗╚██████╔╝╚██████╔╝██████╔╝╚██████╗
      ╚═════╝ ╚═════╝  ╚═════╝ ╚═════╝  ╚═════╝

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

spinner() {
    local pid=$1
    local msg=$2
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${CYAN}%s${RESET} %s" "${spin:i++%${#spin}:1}" "$msg"
        sleep 0.1
    done
    printf "\r"
}

# -- Pre-flight checks -------------------------------------------------------
preflight() {
    step 1 4 "Checking prerequisites..."

    if ! command -v xcodebuild &>/dev/null; then
        fail "Xcode command line tools not found. Install Xcode from the App Store."
    fi

    if ! command -v node &>/dev/null; then
        fail "Node.js not found. Install from https://nodejs.org"
    fi

    if [ ! -d "$WORKSPACE" ]; then
        warn "iOS project not found. Running expo prebuild..."
        (cd "$PROJECT_DIR" && npx expo prebuild --clean --platform ios)
    fi

    if [ ! -d "$IOS_DIR/Pods" ]; then
        warn "CocoaPods not installed. Running pod install..."
        (cd "$IOS_DIR" && pod install --quiet)
    fi

    success "Prerequisites OK"
    echo ""
}

# -- Clean previous builds ---------------------------------------------------
clean() {
    step 2 4 "Cleaning previous builds..."
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    success "Clean build directory ready"
    echo ""
}

# -- Archive with Xcode ------------------------------------------------------
archive() {
    step 3 4 "Archiving with Xcode..."

    local archive_log="$BUILD_DIR/archive.log"

    xcodebuild \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -configuration Release \
        -archivePath "$ARCHIVE_PATH" \
        -destination "generic/platform=iOS" \
        -quiet \
        archive \
        CODE_SIGNING_ALLOWED=NO \
        > "$archive_log" 2>&1 || {
            echo ""
            echo -e "${RED}  Xcode archive failed. Check the log:${RESET}"
            echo -e "  ${DIM}$archive_log${RESET}"
            fail "Archive failed"
        }

    success "Archive complete"
    echo ""
}

# -- Package IPA -------------------------------------------------------------
package() {
    step 4 4 "Packaging IPA..."

    local archive_app="$ARCHIVE_PATH/Products/Applications/$APP_NAME.app"
    local payload_dir="$BUILD_DIR/Payload"

    if [ ! -d "$archive_app" ]; then
        fail "Built .app not found at $archive_app"
    fi

    # Create Payload structure
    rm -rf "$payload_dir"
    mkdir -p "$payload_dir"
    cp -R "$archive_app" "$payload_dir/"

    # Create IPA (zip)
    (cd "$BUILD_DIR" && zip -r -q "$IPA_NAME" "Payload")

    # Clean up temp files
    rm -rf "$payload_dir"
    rm -rf "$ARCHIVE_PATH"

    if [ ! -f "$IPA_PATH" ]; then
        fail "IPA file was not created"
    fi

    local size
    size=$(du -h "$IPA_PATH" | cut -f1)

    success "IPA packaged"
    echo ""

    # -- Done! ----------------------------------------------------------------
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo ""
    echo -e "  ${GREEN}${BOLD}  BUILD COMPLETE${RESET}"
    echo ""
    echo -e "  ${BOLD}  Version:${RESET}  $VERSION"
    echo -e "  ${BOLD}  Output:${RESET}   $IPA_PATH"
    echo -e "  ${BOLD}  Size:${RESET}     $size"
    echo ""
    echo -e "  ${DIM}  Sideload with AltStore, SideStore, or any IPA signing tool.${RESET}"
    echo -e "  ${DIM}  Apps signed with a free Apple ID expire after 7 days.${RESET}"
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
    clean
    archive
    package
}

main "$@"
