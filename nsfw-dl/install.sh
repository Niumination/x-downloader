#!/usr/bin/env bash
# nsfw-dl installer for Arch Linux (works on Arch-based distros too)
# Usage: ./install.sh [--user] [--plugin] [--no-deps]
#   --user    install to ~/.local instead of /usr/local (no sudo for app)
#   --plugin  also install yt-dlp-plugin-yellow (MissAV / 91porn / Jable.tv)
#   --no-deps skip pacman dependency installation
#   --force   re-install even if present
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
APP_NAME="nsfw-dl"
APP_VERSION="$(grep -m1 '^APP_VERSION' "$SCRIPT_DIR/nsfw-dl" | cut -d'"' -f2)"
INSTALL_USER=0
INSTALL_PLUGIN=0
SKIP_DEPS=0
FORCE=0

for arg in "$@"; do
    case "$arg" in
        --user)    INSTALL_USER=1 ;;
        --plugin)  INSTALL_PLUGIN=1 ;;
        --no-deps) SKIP_DEPS=1 ;;
        --force)   FORCE=1 ;;
        -h|--help)
            sed -n '2,12p' "$0"
            exit 0
            ;;
        *) echo "Unknown option: $arg"; exit 1 ;;
    esac
done

# ---- Sanity checks ----
echo "==> nsfw-dl installer (v$APP_VERSION)"
echo "    Source: $SCRIPT_DIR"

if [[ ! -f "$SCRIPT_DIR/nsfw-dl" ]]; then
    echo "!! Error: nsfw-dl script not found in $SCRIPT_DIR" >&2
    exit 1
fi

# Detect distro
DISTRO_ID="$( (grep -m1 '^ID=' /etc/os-release 2>/dev/null || echo 'ID=unknown') | cut -d= -f2 )"
DISTRO_LIKE="$( (grep -m1 '^ID_LIKE=' /etc/os-release 2>/dev/null || echo 'ID_LIKE=unknown') | cut -d= -f2 )"
echo "    Detected distro: $DISTRO_ID (like: $DISTRO_LIKE)"

is_arch=0
case "$DISTRO_ID" in
    arch|garuda|manjaro|endeavouros|cachyos|archcraft|artix) is_arch=1 ;;
esac
if [[ "$DISTRO_LIKE" == *arch* ]]; then is_arch=1; fi

# ---- Pick install prefix ----
if [[ $INSTALL_USER -eq 1 ]]; then
    PREFIX="$HOME/.local"
    echo "    Mode: user install (no sudo)"
    SUDO=""
else
    PREFIX="/usr/local"
    SUDO="sudo"
    if [[ $EUID -eq 0 ]]; then SUDO=""; fi
    echo "    Mode: system install (uses sudo for $PREFIX)"
fi

BIN_DIR="$PREFIX/bin"
SHARE_DIR="$PREFIX/share"
APP_DIR="$SHARE_DIR/$APP_NAME"
ICON_DIR="$SHARE_DIR/icons/hicolor/scalable/apps"
DESKTOP_DIR="$SHARE_DIR/applications"

# ---- Dependencies ----
REQUIRED_PKGS=(python python-gobject gtk4 libadwaita yt-dlp ffmpeg desktop-file-utils)
MISSING=()
if command -v pacman >/dev/null 2>&1; then
    for p in "${REQUIRED_PKGS[@]}"; do
        if ! pacman -Qq "$p" &>/dev/null 2>&1; then
            MISSING+=("$p")
        fi
    done
fi

if [[ $SKIP_DEPS -eq 0 ]]; then
    if [[ ${#MISSING[@]} -gt 0 ]]; then
        if [[ $is_arch -eq 1 ]] && command -v pacman >/dev/null 2>&1; then
            echo "==> Installing missing dependencies: ${MISSING[*]}"
            sudo pacman -S --needed --noconfirm "${MISSING[@]}"
        else
            echo "!! Non-Arch distro or pacman unavailable." >&2
            echo "   Please install these manually: ${MISSING[*]}" >&2
            echo "   (Re-run with --no-deps once installed.)" >&2
            if [[ $is_arch -eq 1 ]]; then exit 1; fi
        fi
    else
        echo "==> All system dependencies already installed"
    fi
else
    echo "==> Skipping dependency install (--no-deps)"
fi

# ---- Verify runtime ----
echo "==> Verifying runtime ..."
PY="${PYTHON:-python}"
if ! command -v "$PY" >/dev/null 2>&1; then
    PY="python3"
    if ! command -v "$PY" >/dev/null 2>&1; then
        echo "!! python3 not found" >&2; exit 1
    fi
fi
echo "    Python: $($PY --version 2>&1)"

# Check Python GTK bindings are usable (Arch package provides them).
if ! "$PY" -c "import gi; gi.require_version('Gtk','4.0'); gi.require_version('Adw','1'); from gi.repository import Gtk, Adw; print('    GTK:', Gtk.MAJOR_VERSION, 'Adw:', Adw.MAJOR_VERSION)" 2>/dev/null; then
    echo "!! GTK4/libadwaita Python bindings not usable." >&2
    echo "   On Arch: sudo pacman -S python-gobject gtk4 libadwaita" >&2
    exit 1
fi

# Check yt-dlp
if ! command -v yt-dlp >/dev/null 2>&1; then
    echo "!! yt-dlp not found on PATH." >&2
    echo "   On Arch: sudo pacman -S yt-dlp" >&2
    exit 1
fi
echo "    yt-dlp: $(yt-dlp --version 2>&1 | head -1)"

# ---- Install files ----
echo "==> Installing files ..."
$SUDO install -d -m 755 "$BIN_DIR" "$APP_DIR" "$APP_DIR/assets" \
    "$ICON_DIR" "$DESKTOP_DIR"

$SUDO install -m 755 "$SCRIPT_DIR/nsfw-dl" "$BIN_DIR/$APP_NAME"

$SUDO install -m 644 "$SCRIPT_DIR/nsfw-dl.desktop" "$DESKTOP_DIR/$APP_NAME.desktop"
$SUDO install -m 644 "$SCRIPT_DIR/assets/icon.svg" "$ICON_DIR/$APP_NAME.svg"
$SUDO install -m 644 "$SCRIPT_DIR/assets/icon-symbolic.svg" \
    "$ICON_DIR/$APP_NAME-symbolic.svg"

# Update caches
if command -v update-desktop-database >/dev/null 2>&1; then
    $SUDO update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    $SUDO gtk-update-icon-cache -f "$SHARE_DIR/icons/hicolor" 2>/dev/null || true
fi

# ---- Optional: MissAV plugin ----
if [[ $INSTALL_PLUGIN -eq 1 ]]; then
    echo "==> Installing yt-dlp-plugin-yellow (MissAV/91porn/Jable.tv) ..."
    if "$PY" -m pip show yt-dlp-plugin-yellow &>/dev/null; then
        echo "    Already installed"
    else
        "$PY" -m pip install --user --break-system-packages --upgrade \
            yt-dlp-plugin-yellow || \
        $SUDO "$PY" -m pip install --break-system-packages --upgrade \
            yt-dlp-plugin-yellow || true
    fi
fi

# ---- Done ----
echo
echo "==> nsfw-dl installed successfully"
echo "    Binary:    $BIN_DIR/$APP_NAME"
echo "    Desktop:   $DESKTOP_DIR/$APP_NAME.desktop"
echo "    Icon:      $ICON_DIR/$APP_NAME.svg"
echo
echo "Usage:"
echo "  $APP_NAME                 # Launch GUI"
echo "  $APP_NAME URL             # CLI download"
echo "  $APP_NAME --update        # Update yt-dlp"
echo "  $APP_NAME --install-plugin # Install MissAV plugin"
echo "  $APP_NAME --list-sites    # Show supported sites"
echo
if [[ $INSTALL_USER -eq 1 ]]; then
    echo "NOTE: Make sure $HOME/.local/bin is in your PATH."
fi
