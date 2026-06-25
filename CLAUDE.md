# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

Always respond in Indonesian (Bahasa Indonesia).

## What this is

`nsfw-dl` is a single-file Python yt-dlp frontend for Arch Linux + Hyprland. It
ships both a GTK4/libadwaita GUI (native Wayland) and a CLI from the same script.
All application code lives in `nsfw-dl/nsfw-dl` (~1900 lines, no build step, no
dependency manager — it's a runnable executable).

The repo root also contains throwaway runtime artifacts (`Videos/`, `.config/`,
`bin/ffprobe`) that are not part of the project; the actual project is the
`nsfw-dl/` directory.

## Commands

```bash
cd nsfw-dl

# Run from source (no build needed)
./nsfw-dl                       # GUI (default when stdout is a TTY)
./nsfw-dl --gui                 # force GUI
./nsfw-dl URL -q 1080 -o ~/v    # CLI download
./nsfw-dl --check URL           # test if a URL is supported (prints title/duration)
./nsfw-dl --list-sites          # dump KNOWN_SITES table
./nsfw-dl --version             # versions + config path

# Install / uninstall (Arch). Installs to /usr/local by default.
./install.sh --plugin           # system install + MissAV plugin
./install.sh --user             # install to ~/.local, no sudo
./uninstall.sh [--user]

# Package
makepkg -si                     # uses PKGBUILD
```

There is **no test suite, linter config, or CI**. The script targets Python 3
with `from __future__ import annotations` and uses PEP 604 type hints throughout.
`install.sh` is the closest thing to a smoke test — it verifies the GTK/Adw
bindings and yt-dlp are importable/on PATH.

## Architecture

The script is organized top-to-bottom as labeled sections (search for the
`# ----` comment banners). Key flow:

1. **Config layer** — `load_settings()`/`save_settings()` read/write
   `~/.config/nsfw-dl/config.json`. `DEFAULT_SETTINGS` is the schema of record;
   both GUI and CLI share this one config file, so settings persist across modes.

2. **Site detection** — `KNOWN_SITES: dict[str, SiteConfig]` maps a hostname to
   per-site workarounds (`referer`, `impersonate`, `needs_plugin`,
   `needs_cookies`). `detect_site(url)` matches the URL's host against it. This is
   the single source of truth for site-specific behavior — add new site quirks
   here, not in the download path.

3. **Options builder** — `build_ydl_opts(url, settings)` translates settings +
   the matched `SiteConfig` into a yt-dlp options dict (format preset, output
   template, postprocessors for metadata/thumbnail/subs, download archive,
   cookies, referer, impersonate).

4. **Download engine** — `run_download()` has **two execution paths**:
   - Preferred: the `yt_dlp` Python module (richer progress hooks, cancel via
     `threading.Event` raising inside the hook). Note the impersonate quirk: the
     Python API needs an `ImpersonateTarget` object, so the string `"chrome"`
     from `build_ydl_opts` is converted via `_parse_impersonate_targets`.
   - Fallback: shelling out to the `yt-dlp` binary when the module isn't
     importable. **The fallback rebuilds the command line by hand** from the same
     opts dict — if you add an option to `build_ydl_opts`, wire it into both
     paths or it silently won't apply in the subprocess path.
   - Post-processing failures (e.g. ffprobe/metadata embed) are treated as
     success if `_find_downloaded_file()` confirms a non-empty file landed.

5. **Concurrency** — downloads run through a `ThreadPoolExecutor`
   (`concurrent_downloads` setting). The GUI marshals worker-thread callbacks
   back onto the GTK main loop with `GLib.idle_add`.

6. **Entry dispatch** — `main()` (bottom of file) parses args via `build_parser()`
   and routes to `gui_main()`, `cli_main()`, or the one-shot actions
   (`--update`, `--install-plugin`, `--list-sites`, `--check`). With no URL and a
   TTY it launches the GUI.

7. **GUI** — `gui_main()` is one large function (~1000 lines) holding the entire
   Adw application: queue rows, settings dialog (Adw.PreferencesWindow), header
   buttons, drag-and-drop, and `Gio.Notification` on completion. GTK imports
   happen lazily inside this function so CLI usage works without a display.

## Conventions

- **Adding a supported site:** add an entry to `KNOWN_SITES`. If it needs a pip
  plugin, set `needs_plugin` — `run_download()` gates on `plugin_installed()` and
  surfaces an install hint; the GUI shows a plugin-install button.
- **Quality presets** live in `FORMAT_PRESETS` (preset name → yt-dlp format
  string); `QUALITY_LABELS` is derived from its keys and drives the GUI dropdown.
- **Bumping the version:** `APP_VERSION` in `nsfw-dl`, `pkgver` in `PKGBUILD`, and
  the README must be kept in sync. `install.sh` reads `APP_VERSION` out of the
  script via grep.
- Plugin handling targets `yt-dlp-plugin-yellow` (MissAV / 91porn / Jable.tv),
  installed via pip with `--break-system-packages` into the user site.
