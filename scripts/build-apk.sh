#!/usr/bin/env bash
# ============================================================================
#  Coda Android APK Builder
#
#  Launches an EAS cloud build, prints the build page (logs) URL right away,
#  shows live progress with a time estimate based on your previous builds,
#  then downloads the finished APK to build/.
#
#  Usage: bash scripts/build-apk.sh [options]
#
#    --id <build-id>     Watch/download an existing build instead of starting one
#    --profile <name>    EAS build profile (default: preview-android)
#    --no-download       Stop when the build finishes, without downloading the APK
#    --open              Open the build page in your browser
#    --timeout <secs>    Stop watching after N seconds (default: 3600, 0 = never)
#    -h, --help          Show this help
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
PROFILE="preview-android"
ATTACH_ID=""
DO_DOWNLOAD=1
OPEN_BROWSER=0
TIMEOUT=3600

# -- Derived values ----------------------------------------------------------
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/build"
STATE_FILE="$BUILD_DIR/last-build.txt"
VERSION=$(node -e "const a=require('$PROJECT_DIR/app.json'); console.log(a.expo.version)" 2>/dev/null || echo "1.0.0")
SLUG=$(node -e "const a=require('$PROJECT_DIR/app.json'); console.log(a.expo.slug || '')" 2>/dev/null || echo "")
OWNER=$(node -e "const a=require('$PROJECT_DIR/app.json'); console.log(a.expo.owner || '')" 2>/dev/null || echo "")
APK_NAME="Coda-v${VERSION}.apk"
APK_PATH="$BUILD_DIR/$APK_NAME"

POLL_INTERVAL=15
DEFAULT_ESTIMATE=1200

BUILD_ID=""
BUILD_URL=""
CREATED_AT=""
ESTIMATE=""
ESTIMATE_SRC=""

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
    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
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

# Only rewrite the line in place when attached to a terminal.
clear_line() {
    if [ -t 1 ]; then printf '\r\033[K'; fi
    return 0
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

# Read a dotted field out of JSON on stdin (handles a single object or an array).
json_get() {
    node -e '
        let raw = "";
        process.stdin.on("data", c => raw += c).on("end", () => {
            let v;
            try { v = JSON.parse(raw); } catch { console.log(""); return; }
            if (Array.isArray(v)) v = v[0] || {};
            for (const k of process.argv[1].split(".")) {
                if (v == null) break;
                v = v[k];
            }
            console.log(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v);
        });
    ' "$1"
}

epoch_of() {
    node -e 'const t = Date.parse(process.argv[1] || ""); console.log(Number.isFinite(t) ? Math.floor(t / 1000) : "")' "$1"
}

bar() {
    local pct=${1:-0} width=20 filled i out=""
    [ "$pct" -lt 0 ] && pct=0
    [ "$pct" -gt 100 ] && pct=100
    filled=$((pct * width / 100))
    for ((i = 0; i < width; i++)); do
        if [ "$i" -lt "$filled" ]; then out+="█"; else out+="░"; fi
    done
    printf '%s' "$out"
}

pretty_status() {
    local s
    s=$(printf '%s' "${1:-unknown}" | tr '[:upper:]' '[:lower:]' | tr '_-' '  ')
    case "$s" in
        "in queue" | queued | new) echo "in queue" ;;
        "in progress") echo "building" ;;
        finished) echo "finished" ;;
        "") echo "starting" ;;
        *) echo "$s" ;;
    esac
}

build_page_url() {
    # EAS JSON does not expose the web URL, but it is deterministic.
    if [ -n "${OWNER:-}" ] && [ -n "${SLUG:-}" ] && [ -n "${BUILD_ID:-}" ]; then
        echo "https://expo.dev/accounts/${OWNER}/projects/${SLUG}/builds/${BUILD_ID}"
    fi
}

# Median wall-clock time of your last few finished builds, so the countdown
# reflects real queue + build times instead of a guess.
history_seconds() {
    local json
    json=$(cd "$PROJECT_DIR" && eas build:list --platform android --limit 8 --json 2>/dev/null) || return 0
    [ -z "$json" ] && return 0
    printf '%s' "$json" | node -e '
        let raw = "";
        process.stdin.on("data", c => raw += c).on("end", () => {
            const profile = process.argv[1];
            let list = [];
            try { list = JSON.parse(raw); } catch { return; }
            if (!Array.isArray(list)) return;
            const secs = list
                .filter(b => b && b.status === "FINISHED" && b.createdAt && b.completedAt)
                .filter(b => !profile || !b.buildProfile || b.buildProfile === profile)
                .map(b => (Date.parse(b.completedAt) - Date.parse(b.createdAt)) / 1000)
                .filter(s => Number.isFinite(s) && s > 60)
                .sort((a, b) => a - b);
            if (!secs.length) return;
            console.log(Math.round(secs[Math.floor(secs.length / 2)]));
        });
    ' "$PROFILE"
}

load_estimate() {
    ESTIMATE=$(history_seconds)
    if [ -n "$ESTIMATE" ]; then
        ESTIMATE_SRC="from your recent builds"
    else
        ESTIMATE=$DEFAULT_ESTIMATE
        ESTIMATE_SRC="rough estimate"
    fi
}

on_interrupt() {
    printf '\n\n'
    if [ -n "${BUILD_URL:-}" ]; then
        warn "Stopped watching — the cloud build keeps running."
        echo -e "  ${BOLD}Build page:${RESET} ${CYAN}${BUILD_URL}${RESET}"
        echo -e "  ${DIM}Reconnect:  bash scripts/build-apk.sh --id ${BUILD_ID}${RESET}"
    fi
    exit 130
}
trap on_interrupt INT TERM

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
            --id)
                ATTACH_ID="${2:-}"
                [ -z "$ATTACH_ID" ] && fail "--id needs a build ID"
                shift 2
                ;;
            --profile)
                PROFILE="${2:-}"
                [ -z "$PROFILE" ] && fail "--profile needs a name"
                shift 2
                ;;
            --no-download)
                DO_DOWNLOAD=0
                shift
                ;;
            --open)
                OPEN_BROWSER=1
                shift
                ;;
            --timeout)
                TIMEOUT="${2:-}"
                case "$TIMEOUT" in
                    '' | *[!0-9]*) fail "--timeout needs a number of seconds" ;;
                esac
                shift 2
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

    command -v eas >/dev/null 2>&1 || fail "EAS CLI not found. Install with: npm install -g eas-cli"
    command -v node >/dev/null 2>&1 || fail "Node.js not found. Install from https://nodejs.org"

    local who
    who=$(eas whoami 2>/dev/null | head -1 | tr -d '\r')
    [ -z "$who" ] && fail "Not logged in to EAS. Run: eas login"
    [ -z "$OWNER" ] && OWNER="$who"

    [ -f "$PROJECT_DIR/eas.json" ] || fail "eas.json not found. Run: eas build:configure"

    if ! node -e "const e=require('$PROJECT_DIR/eas.json'); if(!e.build['$PROFILE']) throw 1" 2>/dev/null; then
        fail "Profile '$PROFILE' not found in eas.json"
    fi

    success "Prerequisites OK (account: $who, profile: $PROFILE)"
    echo ""
}

# -- Launch build ------------------------------------------------------------
launch_build() {
    step 2 4 "Launching Android build on EAS Cloud..."

    mkdir -p "$BUILD_DIR"

    if [ -n "$ATTACH_ID" ]; then
        BUILD_ID="$ATTACH_ID"
        local view_json
        view_json=$(cd "$PROJECT_DIR" && eas build:view "$BUILD_ID" --json 2>/dev/null) || view_json=""
        if [ -z "$view_json" ]; then
            fail "Could not load build $BUILD_ID. Check the ID with: eas build:list"
        fi
        CREATED_AT=$(printf '%s' "$view_json" | json_get createdAt)
        success "Attaching to build ${BUILD_ID:0:8}"
    else
        local err_log="$BUILD_DIR/eas-launch.log"
        local build_output
        if ! build_output=$(cd "$PROJECT_DIR" && eas build --platform android --profile "$PROFILE" --non-interactive --json 2>"$err_log"); then
            echo ""
            echo -e "${RED}  EAS Build launch failed:${RESET}"
            tail -20 "$err_log" 2>/dev/null || true
            fail "Build launch failed"
        fi

        BUILD_ID=$(printf '%s' "$build_output" | json_get id)
        CREATED_AT=$(printf '%s' "$build_output" | json_get createdAt)
        [ -z "$BUILD_ID" ] && fail "Could not parse build ID from EAS output"

        success "Build launched (ID: ${BUILD_ID:0:8})"
    fi

    BUILD_URL=$(build_page_url)
    [ -z "$CREATED_AT" ] && CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Keep the last build around so `--id <id>` is easy next time.
    printf 'id=%s\nurl=%s\ncreated=%s\n' "$BUILD_ID" "$BUILD_URL" "$CREATED_AT" > "$STATE_FILE"

    echo ""
    if [ -n "$BUILD_URL" ]; then
        echo -e "  ${BOLD}Build page:${RESET} ${CYAN}${BUILD_URL}${RESET}"
        info "Open this to watch the live logs or share the build."
    fi

    if [ "$OPEN_BROWSER" -eq 1 ] && [ -n "$BUILD_URL" ]; then
        command -v open >/dev/null 2>&1 && open "$BUILD_URL"
        command -v xdg-open >/dev/null 2>&1 && xdg-open "$BUILD_URL" >/dev/null 2>&1 || true
    fi
    echo ""
}

# -- Wait for build ----------------------------------------------------------
wait_for_build() {
    step 3 4 "Waiting for build to complete..."

    local tty=0
    [ -t 1 ] && tty=1

    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    local last_status="" last_pct=""

    info "Ctrl-C stops watching only — the build keeps running in the cloud."
    echo ""

    while :; do
        local info_json status now created_epoch elapsed pct remaining line

        info_json=$(cd "$PROJECT_DIR" && eas build:view "$BUILD_ID" --json 2>/dev/null) || info_json=""
        status=$(printf '%s' "$info_json" | json_get status)
        status=$(printf '%s' "${status:-unknown}" | tr '[:upper:]' '[:lower:]')

        case "$status" in
            finished)
                clear_line
                now=$(date +%s)
                created_epoch=$(epoch_of "$CREATED_AT")
                local completed_epoch dur
                completed_epoch=$(epoch_of "$(printf '%s' "$info_json" | json_get completedAt)")
                if [ -n "$created_epoch" ] && [ -n "$completed_epoch" ] && [ "$completed_epoch" -ge "$created_epoch" ]; then
                    dur=$((completed_epoch - created_epoch))
                elif [ -n "$created_epoch" ]; then
                    dur=$((now - created_epoch))
                else
                    dur=0
                fi
                success "Build finished in $(fmt_dur "$dur")"
                echo ""
                return 0
                ;;
            errored | error | cancelled | canceled)
                clear_line
                echo ""
                local err_msg
                err_msg=$(printf '%s' "$info_json" | json_get error.message)
                fail "Build $status${err_msg:+: $err_msg}"
                ;;
        esac

        now=$(date +%s)
        created_epoch=$(epoch_of "$CREATED_AT")
        if [ -n "$created_epoch" ]; then
            elapsed=$((now - created_epoch))
        else
            elapsed=$((elapsed + POLL_INTERVAL))
        fi
        [ "$elapsed" -lt 0 ] && elapsed=0

        if [ "$TIMEOUT" -gt 0 ] && [ "$elapsed" -ge "$TIMEOUT" ] && [ "$elapsed" -gt 0 ]; then
            clear_line
            echo ""
            warn "Stopped watching after $(fmt_dur "$elapsed") — the build is still running."
            [ -n "$BUILD_URL" ] && echo -e "  ${BOLD}Build page:${RESET} ${CYAN}${BUILD_URL}${RESET}"
            echo -e "  ${DIM}Reconnect:  bash scripts/build-apk.sh --id ${BUILD_ID}${RESET}"
            exit 1
        fi

        if [ "$ESTIMATE" -gt 0 ]; then
            pct=$((elapsed * 100 / ESTIMATE))
            [ "$pct" -gt 99 ] && pct=99
            remaining=$((ESTIMATE - elapsed))
            [ "$remaining" -lt 0 ] && remaining=0
            line="  ${CYAN}${spin:i++%${#spin}:1}${RESET} $(pretty_status "$status")  $(bar "$pct")  ${pct}%   $(fmt_dur "$elapsed") elapsed · ~$(fmt_dur "$remaining") left"
        else
            line="  ${CYAN}${spin:i++%${#spin}:1}${RESET} $(pretty_status "$status")  $(fmt_dur "$elapsed") elapsed"
        fi

        if [ "$tty" -eq 1 ]; then
            printf '\r\033[K%s' "$line"
        else
            # No cursor tricks when output is piped/logged: one line per change.
            if [ "$status" != "$last_status" ] || [ "${pct:-}" != "$last_pct" ]; then
                echo -e "  $(pretty_status "$status")  ${pct:+${pct}%  }$(fmt_dur "$elapsed") elapsed"
            fi
        fi
        last_status="$status"
        last_pct="${pct:-}"

        sleep $POLL_INTERVAL
    done
}

# -- Download APK ------------------------------------------------------------
download_apk() {
    if [ "$DO_DOWNLOAD" -eq 0 ]; then
        echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
        echo ""
        echo -e "  ${GREEN}${BOLD}BUILD COMPLETE${RESET}"
        echo ""
        echo -e "  ${BOLD}Version:${RESET}  $VERSION"
        [ -n "$BUILD_URL" ] && echo -e "  ${BOLD}Build page:${RESET} $BUILD_URL"
        echo ""
        info "Download it later with:"
        echo -e "  ${DIM}eas build:download --id $BUILD_ID --path build/${RESET}"
        echo ""
        echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
        echo ""
        return 0
    fi

    step 4 4 "Downloading APK..."

    mkdir -p "$BUILD_DIR"
    (cd "$PROJECT_DIR" && eas build:download --id "$BUILD_ID" --path "$BUILD_DIR" 2>&1) || fail "Failed to download APK"

    local downloaded
    downloaded=$(ls -t "$BUILD_DIR"/*.apk 2>/dev/null | head -1 || true)
    [ -z "$downloaded" ] && fail "APK file not found after download"

    if [ "$(cd "$(dirname "$downloaded")" && pwd)/$(basename "$downloaded")" != "$APK_PATH" ]; then
        mv -f "$downloaded" "$APK_PATH"
    fi
    [ -f "$APK_PATH" ] || fail "APK file missing at $APK_PATH"

    local size sha
    size=$(du -h "$APK_PATH" | cut -f1)
    if command -v shasum >/dev/null 2>&1; then
        sha=$(shasum -a 256 "$APK_PATH" | cut -d' ' -f1)
    elif command -v sha256sum >/dev/null 2>&1; then
        sha=$(sha256sum "$APK_PATH" | cut -d' ' -f1)
    else
        sha="(sha256 tool not found)"
    fi

    success "APK downloaded"
    echo ""

    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo ""
    echo -e "  ${GREEN}${BOLD}BUILD COMPLETE${RESET}"
    echo ""
    echo -e "  ${BOLD}Version:${RESET}   $VERSION"
    echo -e "  ${BOLD}Output:${RESET}    $APK_PATH"
    echo -e "  ${BOLD}Size:${RESET}      $size"
    echo -e "  ${BOLD}SHA-256:${RESET}   $sha"
    [ -n "$BUILD_URL" ] && echo -e "  ${BOLD}Build page:${RESET} $BUILD_URL"
    echo ""
    echo -e "  ${DIM}Transfer to your Android device and install, or:${RESET}"
    echo -e "  ${DIM}adb install -r \"$APK_PATH\"${RESET}"
    echo -e "  ${DIM}Enable 'Install from unknown sources' if prompted.${RESET}"
    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo -e "  ${DIM}@graphicsprocessingunit${RESET}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${RESET}"
    echo ""
}

# -- Main --------------------------------------------------------------------
main() {
    parse_args "$@"
    print_banner
    preflight
    load_estimate
    launch_build
    echo -e "  ${DIM}Typical build time ${ESTIMATE_SRC}: ~$(fmt_dur "$ESTIMATE")${RESET}"
    echo ""
    wait_for_build
    download_apk
}

main "$@"
