# AGENTS.md

## Project overview

Single-file Python yt-dlp frontend (`nsfw-dl/nsfw-dl`, ~2000 lines). Ships both
a GTK4/libadwaita GUI and a CLI from the same script. Primary target: Arch Linux
+ Hyprland. Also runs on macOS with GTK4 (no libadwaita). No build step, no
dependency manager — it's a directly runnable executable.

## Language

Respond in Indonesian (Bahasa Indonesia) as specified in CLAUDE.md.

## Run from source

```bash
cd nsfw-dl
./nsfw-dl                    # GUI (default when no args)
./nsfw-dl URL                # CLI download
./nsfw-dl --version          # version info
./nsfw-dl --list-sites       # dump known sites
./nsfw-dl --check URL        # test URL support
```

## Syntax check

No linter or type checker is configured. Use Python's built-in compile check:

```bash
python3 -m py_compile nsfw-dl/nsfw-dl
```

## Install / uninstall

```bash
cd nsfw-dl
./install.sh --plugin         # system install + MissAV plugin (needs sudo)
./install.sh --user           # install to ~/.local, no sudo
./uninstall.sh [--user]
```

Or via AUR: `makepkg -si` (from the `nsfw-dl/` directory).

## Architecture

Everything lives in one file: `nsfw-dl/nsfw-dl`. Key sections (search for `# ----` banners):

- **Config layer** — `load_settings()` / `save_settings()` read/write `~/.config/nsfw-dl/config.json`
- **Site detection** — `KNOWN_SITES: dict[str, SiteConfig]` maps hostnames to per-site workarounds
- **Options builder** — `build_ydl_opts()` translates settings + site config into yt-dlp options
- **Download engine** — `run_download()` with two paths: Python `yt_dlp` module (preferred) and subprocess fallback (rebuilds command from opts dict — keep both paths in sync)
- **GUI** — `gui_main()` is ~800 lines, minimal GTK4/Adw design: URL input + quality picker + download button, queue list with progress bars, settings dialog. Simple like popular video downloaders (4K Video Downloader style).
- **CLI** — `cli_main()` handles terminal workflow

## Conventions

- **Adding a site**: add entry to `KNOWN_SITES`. Set `needs_plugin` for pip plugins. `run_download()` gates on `plugin_installed()` and surfaces install hints.
- **Quality presets**: `FORMAT_PRESETS` dict maps preset names to yt-dlp format strings. `QUALITY_LABELS` derives from its keys.
- **Bump version in 3 places**: `APP_VERSION` in `nsfw-dl/nsfw-dl`, `pkgver` in `PKGBUILD`, and `README.md`.
- **Config shared**: GUI and CLI use the same `~/.config/nsfw-dl/config.json`. Changes persist across modes.
- **Fallback download path**: if you add an option to `build_ydl_opts()`, wire it into both the Python module path AND the subprocess path in `run_download()`, or it silently won't apply in the subprocess fallback.
- **GTK imports are lazy**: they happen inside `gui_main()` so CLI usage works without a display server.
- **macOS GUI fallback**: if libadwaita (`Adw`) is unavailable, the GUI uses pure GTK4. Helper factories (`_make_header_bar`, `_make_switch_row`, etc.) abstract the differences. When adding new UI elements, use these helpers instead of Adw widgets directly.

## Dependencies

**Arch Linux**: `python python-gobject gtk4 libadwaita yt-dlp ffmpeg desktop-file-utils`
**macOS**: `brew install pygobject3 gtk4 yt-dlp ffmpeg` (no libadwaita needed)
Optional: `python-pip` (for yt-dlp-plugin-yellow)

## Testing

No test suite exists. Verify changes with:
1. `python3 -m py_compile nsfw-dl/nsfw-dl` — syntax check
2. `./nsfw-dl --version` — basic smoke test
3. `./nsfw-dl --list-sites` — verify site table renders
4. `./nsfw-dl --check URL` — verify URL checking works

## Gotchas

- `install.sh` reads `APP_VERSION` from the script via `grep` — don't reformat that line.
- The subprocess fallback in `run_download()` manually reconstructs CLI flags from the opts dict. If you add a new yt-dlp option, you must add it in both places.
- Wayland detection: the script auto-sets `GDK_BACKEND=wayland` when `XDG_SESSION_TYPE=wayland` or `HYPRLAND_INSTANCE_SIGNATURE` is set.
- Plugin installs use `--break-system-packages` flag for pip (PEP 668 compliance).
- GUI helper factories (`_make_*`) are defined inside `gui_main()`. They use `HAS_ADW` flag to choose between Adw and GTK widgets. All new UI code should use these factories.
