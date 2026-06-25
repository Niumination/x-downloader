#!/usr/bin/env bash
# nsfw-dl uninstaller. Removes files installed by install.sh.
# Usage: ./uninstall.sh [--user]
set -euo pipefail

INSTALL_USER=0
for arg in "$@"; do
    case "$arg" in
        --user) INSTALL_USER=1 ;;
        *) echo "Unknown option: $arg"; exit 1 ;;
    esac
done

if [[ $INSTALL_USER -eq 1 ]]; then
    PREFIX="$HOME/.local"
    SUDO=""
else
    PREFIX="/usr/local"
    SUDO="sudo"
    [[ $EUID -eq 0 ]] && SUDO=""
fi

APP_NAME="nsfw-dl"
BIN="$PREFIX/bin/$APP_NAME"
DESKTOP="$PREFIX/share/applications/$APP_NAME.desktop"
ICON="$PREFIX/share/icons/hicolor/scalable/apps/$APP_NAME.svg"
ICON_SYM="$PREFIX/share/icons/hicolor/scalable/apps/$APP_NAME-symbolic.svg"

echo "==> Removing nsfw-dl files from $PREFIX"
$SUDO rm -f "$BIN" "$DESKTOP" "$ICON" "$ICON_SYM"

if command -v update-desktop-database >/dev/null 2>&1; then
    $SUDO update-desktop-database "$PREFIX/share/applications" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    $SUDO gtk-update-icon-cache -f "$PREFIX/share/icons/hicolor" 2>/dev/null || true
fi

# Optionally remove pip plugin
if command -v python3 >/dev/null 2>&1; then
    if python3 -m pip show yt-dlp-plugin-yellow &>/dev/null; then
        echo "==> Found yt-dlp-plugin-yellow; leaving it installed (remove with:"
        echo "    python3 -m pip uninstall yt-dlp-plugin-yellow)"
    fi
fi

echo "==> Done"
