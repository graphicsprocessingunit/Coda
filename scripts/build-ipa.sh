#!/usr/bin/env bash
# ============================================================================
#  Coda iOS IPA Builder
#
#  Archives the Xcode project (unsigned), packages a sideloadable IPA and
#  reports the path, size and SHA-256. Existing IPAs in build/ are kept.
#
#  Usage: bash scripts/build-ipa.sh [options]
#
#    --clean           Wipe build/ first (removes previous IPAs and logs)
#    --open            Reveal the finished IPA in Finder
#    -h, --help        Show this help
#
#  by @graphicsprocessingunit
# ============================================================================

set -euo pipefail

# -- Colors ------------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    CYAN='\033[0;36m'
    YELLOW='\033[1;33m'
    MAGENTA='\033[0;35m'
    DIM='\033[2m'
    BOLD='\033[1m'
    RESET='\033[0m'
else
    RED='' GREEN='' CYAN='' YELLOW='' MAGENTA='' DIM='' BOLD='' RESET=''
fi

# -- Options -----------------------------------------------------------------
DO_CLEAN=0
OPEN_FINDER=0

# -- Derived values ----------------------------------------------------------
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$PROJECT_DIR/ios"
WORKSPACE="$IOS_DIR/Coda.xcworkspace"
SCHEME="Coda"
BUILD_DIR="$PROJECT_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/Coda.xcarchive"
APP_NAME="Coda"

VERSION=$(node -e "const a=require('$PROJECT_DIR/app.json'); console.log(a.expo.version)" 2>/dev/null || echo "1.0.0")
IPA_NAME="Coda-v${VERSION}.ipa"
IPA_PATH="$BUILD_DIR/$IPA_NAME"

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

usage() {
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
}

step() {
    local num=$1 total=$2 msg=$3
    echo -e "${CYAN}  [$num/$total]${RESET} ${BOLD}$msg${RESET}"
}

success() { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET} $1"; }
info()    { echo -e "  ${DIM}$1${RESET}"; }

fail() {
    echo -e "  ${RED}✗${RESET} $1"
    echo ""
    exit 1
}

fmt_dur() {
    local s=${1:-0}
    if [ "$s" -ge 3600 ]; then
        printf '%dh %02dm' "$((s / 3600))" "$(((s % 3600) / 60))"
    elif [ "$s" -ge 60 ]; then
        printf '%dm %02ds' "$((s / 60))" "$((s % 60))"
    else
        printf '%ds' "$s"
    fi
}

# Run a command in the background with an elapsed-time readout, then return its
# exit status. Keeps long silent build steps readable.
run_with_timer() {
    local label=$1 log=$2
    shift 2
    local tty=0
    [ -t 1 ] && tty=1
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏' i=0 start=$SECONDS last=0 rc=0

    "$@" >"$log" 2>&1 &
    local pid=$!

    while kill -0 "$pid" 2>/dev/null; do
        local elapsed=$((SECONDS - start))
        if [ "$tty" -eq 1 ]; then
            printf '\r\033[K  %s %s… %s elapsed' \
                "${CYAN}${spin:i++%${#spin}:1}${RESET}" "$label" "$(fmt_dur "$elapsed")"
        elif [ $((elapsed - last)) -ge 15 ]; then
            echo "  $label… $(fmt_dur "$elapsed") elapsed"
            last=$elapsed
        fi
        sleep 1
    done

    if wait "$pid"; then rc=0; else rc=$?; fi
    [ "$tty" -eq 1 ] && printf '\r\033[K'
    return $rc
}

# -- Options parsing ---------------------------------------------------------
parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            -h | --help)
                echo ""
                usage
                echo ""
                exit 0
                ;;
            --clean)
                DO_CLEAN=1
                shift
                ;;
            --open)
                OPEN_FINDER=1
                shift
                ;;
            *)
                fail "Unknown option: $1  (try --help)"
                ;;
        esac
    done
}

# -- Pre-flight checks -------------------------------------------------------
preflight() {
    step 1 4 "Checking prerequisites..."

    command -v xcodebuild >/dev/null 2>&1 || fail "Xcode command line tools not found. Install Xcode from the App Store."
    command -v node >/dev/null 2>&1 || fail "Node.js not found. Install from https://nodejs.org"

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

# -- Prepare build directory -------------------------------------------------
clean() {
    step 2 4 "Preparing build directory..."

    if [ "$DO_CLEAN" -eq 1 ]; then
        rm -rf "$BUILD_DIR"
        success "Removed old build directory"
    else
        rm -rf "$ARCHIVE_PATH"
        rm -rf "$BUILD_DIR/Payload"
        success "Cleaned temporary build files (kept previous IPAs)"
    fi
    mkdir -p "$BUILD_DIR"
    echo ""
}

# -- Archive with Xcode ------------------------------------------------------
archive() {
    step 3 4 "Archiving with Xcode..."

    local archive_log="$BUILD_DIR/archive.log"

    if ! run_with_timer "Compiling $SCHEME (Release)" "$archive_log" \
        xcodebuild \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -configuration Release \
        -archivePath "$ARCHIVE_PATH" \
        -destination "generic/platform=iOS" \
        -quiet \
        archive \
        CODE_SIGNING_ALLOWED=NO; then
        echo ""
        echo -e "${RED}  Xcode archive failed. Last lines of the log:${RESET}"
        tail -20 "$archive_log" 2>/dev/null | sed 's/^/    /' || true
        echo ""
        info "Full log: $archive_log"
        fail "Archive failed"
    fi

    success "Archive complete"
    echo ""
}

# -- Package IPA -------------------------------------------------------------
package() {
    step 4 4 "Packaging IPA..."

    local archive_app="$ARCHIVE_PATH/Products/Applications/$APP_NAME.app"
    local payload_dir="$BUILD_DIR/Payload"

    [ -d "$archive_app" ] || fail "Built .app not found at $archive_app"

    rm -rf "$payload_dir"
    mkdir -p "$payload_dir"
    cp -R "$archive_app" "$payload_dir/"

    # Overwrite instead of updating: zip would otherwise leave stale entries.
    rm -f "$IPA_PATH"
    (cd "$BUILD_DIR" && zip -r -q "$IPA_NAME" "Payload")

    rm -rf "$payload_dir" "$ARCHIVE_PATH"

    [ -f "$IPA_PATH" ] || fail "IPA file was not created"

    local size sha
    size=$(du -h "$IPA_PATH" | cut -f1)
    if command -v shasum >/dev/null 2>&1; then
        sha=$(shasum -a 256 "$IPA_PATH" | cut -d' ' -f1)
    elif command -v sha256sum >/dev/null 2>&1; then
        sha=$(sha256sum "$IPA_PATH" | cut -d' ' -f1)
    else
        sha="(sha256 tool not found)"
    fi

    success "IPA packaged"
    echo ""

    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo ""
    echo -e "  ${GREEN}${BOLD}BUILD COMPLETE${RESET}"
    echo ""
    echo -e "  ${BOLD}Version:${RESET}   $VERSION"
    echo -e "  ${BOLD}Output:${RESET}    $IPA_PATH"
    echo -e "  ${BOLD}Size:${RESET}      $size"
    echo -e "  ${BOLD}SHA-256:${RESET}   $sha"
    echo ""
    info "Total time: $(fmt_dur "$(($SECONDS - BUILD_START))")"
    echo ""
    echo -e "  ${DIM}Unsigned build — sideload with AltStore, SideStore, or any${RESET}"
    echo -e "  ${DIM}IPA signing tool. Free Apple ID signatures expire after 7 days.${RESET}"
    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo -e "  ${DIM}@graphicsprocessingunit${RESET}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo ""

    if [ "$OPEN_FINDER" -eq 1 ] && command -v open >/dev/null 2>&1; then
        open -R "$IPA_PATH"
    fi
}

# -- Main --------------------------------------------------------------------
main() {
    parse_args "$@"
    BUILD_START=$SECONDS
    print_banner
    preflight
    clean
    archive
    package
}

main "$@"
