#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
nsfw-dl - Video downloader for various websites
Runs on Linux (GTK4/libadwaita GUI, great on Hyprland/Wayland) and macOS (CLI).

Features:
  - GUI mode (GTK4 + libadwaita) - native Wayland, looks great on Hyprland
  - CLI mode for terminal workflow
  - Supports 1500+ sites via yt-dlp backend
  - Auto site detection & site-specific workarounds (Pornhub, MissAV, etc.)
  - Auto-install MissAV / 91porn / Jable.tv plugin
  - Browser cookies support (Chrome, Firefox, Brave, ...)
  - Quality selection, format preview, metadata embedding
  - Download queue with concurrent workers
  - Persistent settings (JSON in ~/.config/nsfw-dl/)
  - System notifications on completion (via Gio.Notification)
  - Drag & drop URLs into the queue
  - Keyboard shortcuts (Ctrl+N, Ctrl+,, Ctrl+Q, Ctrl+Return)

Usage:
  nsfw-dl                  # Launch GUI (default if no args)
  nsfw-dl --gui            # Force GUI
  nsfw-dl URL              # CLI download with defaults
  nsfw-dl URL -q 1080      # CLI download at 1080p
  nsfw-dl --update         # Update yt-dlp to latest version
  nsfw-dl --install-plugin # Install MissAV / 91porn / Jable.tv plugin
  nsfw-dl --list-sites     # List all supported sites
  nsfw-dl --version        # Show versions
  nsfw-dl --check URL      # Check whether a URL is supported
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, Future
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
APP_NAME = "nsfw-dl"
APP_ID = "com.github.nsfw-dl"
APP_VERSION = "1.1.0"
CONFIG_DIR = Path.home() / ".config" / APP_NAME
CONFIG_FILE = CONFIG_DIR / "config.json"
LOG_DIR = CONFIG_DIR / "logs"
PLUGIN_DIR = Path.home() / ".local" / "share" / "yt-dlp" / "plugins"
YT_DLP_PLUGIN_PKG = "yt-dlp-plugin-yellow"

# Platform detection (this script runs on Linux and macOS; Windows is best-effort)
IS_MAC = sys.platform == "darwin"
IS_WIN = os.name == "nt"
IS_LINUX = sys.platform.startswith("linux")

# URL validation pattern
URL_RE = re.compile(r"^https?://[^\s<>\"']+$", re.IGNORECASE)

# Quality/format presets -> yt-dlp format strings
FORMAT_PRESETS: dict[str, str] = {
    "best":   "bestvideo*+bestaudio/best",
    "2160p":  "bestvideo[height<=2160]+bestaudio/best[height<=2160]/best",
    "1080p":  "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
    "720p":   "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
    "480p":   "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
    "360p":   "bestvideo[height<=360]+bestaudio/best[height<=360]/best",
    "audio":  "bestaudio/best",
}

QUALITY_LABELS: list[str] = list(FORMAT_PRESETS.keys())

# Cookie browser options (used by both GUI and CLI)
BROWSER_OPTIONS: list[str] = [
    "none", "chrome", "chromium", "firefox", "brave",
    "edge", "opera", "vivaldi", "safari",
]


# ---------------------------------------------------------------------------
# Site-specific tweaks
# ---------------------------------------------------------------------------
@dataclass
class SiteConfig:
    name: str
    referer: str | None = None          # force --referer
    impersonate: bool = False           # use --impersonate chrome
    needs_plugin: str | None = None     # pip package required
    needs_cookies: bool = False         # usually works better with cookies
    extra_args: list[str] = field(default_factory=list)


KNOWN_SITES: dict[str, SiteConfig] = {
    "pornhub.com":      SiteConfig("PornHub",      referer="https://www.pornhub.com/",
                                   impersonate=True),
    "phncdn.com":       SiteConfig("PornHub CDN",  referer="https://www.pornhub.com/"),
    "xvideos.com":      SiteConfig("XVideos"),
    "xhamster.com":     SiteConfig("xHamster",     impersonate=True),
    "xnxx.com":         SiteConfig("XNXX",         impersonate=True),
    "redtube.com":      SiteConfig("RedTube"),
    "youporn.com":      SiteConfig("YouPorn"),
    "spankbang.com":    SiteConfig("SpankBang"),
    # MissAV uses multiple domains; all share the same plugin
    "missav.com":       SiteConfig("MissAV",       impersonate=True,
                                   needs_plugin=YT_DLP_PLUGIN_PKG),
    "missav.ws":        SiteConfig("MissAV",       impersonate=True,
                                   needs_plugin=YT_DLP_PLUGIN_PKG),
    "missav.ai":        SiteConfig("MissAV",       impersonate=True,
                                   needs_plugin=YT_DLP_PLUGIN_PKG),
    "missav.vip":       SiteConfig("MissAV",       impersonate=True,
                                   needs_plugin=YT_DLP_PLUGIN_PKG),
    "missav.la":        SiteConfig("MissAV",       impersonate=True,
                                   needs_plugin=YT_DLP_PLUGIN_PKG),
    "91porn.com":       SiteConfig("91Porn",       needs_plugin=YT_DLP_PLUGIN_PKG),
    "jable.tv":         SiteConfig("Jable.tv",     needs_plugin=YT_DLP_PLUGIN_PKG),
    "hentaicity.com":   SiteConfig("HentaiCity"),
    "hanime.tv":        SiteConfig("Hanime.tv"),
    "erome.com":        SiteConfig("Erome"),
    "heavy-r.com":      SiteConfig("Heavy-R"),
    "eporner.com":      SiteConfig("Eporner"),
    "motherless.com":   SiteConfig("Motherless"),
    "twistys.com":      SiteConfig("Twistys"),
    "brazzers.com":     SiteConfig("Brazzers",     impersonate=True),
    "onlyfans.com":     SiteConfig("OnlyFans",     needs_cookies=True, impersonate=True),
    "fansly.com":       SiteConfig("Fansly",       needs_cookies=True, impersonate=True),
    "twitter.com":      SiteConfig("Twitter/X",    needs_cookies=True),
    "x.com":            SiteConfig("Twitter/X",    needs_cookies=True),
    "reddit.com":       SiteConfig("Reddit",       needs_cookies=True),
}


# ---------------------------------------------------------------------------
# Logging helper (CLI; GUI has its own widget)
# ---------------------------------------------------------------------------
def _log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def _err(msg: str) -> None:
    print(f"!! {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Platform helpers (Linux / macOS / Windows)
# ---------------------------------------------------------------------------
def install_hint(pkg: str) -> str:
    """OS-appropriate hint for installing a missing system package."""
    if IS_MAC:
        return f"On macOS:  brew install {pkg}"
    if IS_WIN:
        return f"Install {pkg} and make sure it is on your PATH"
    # Linux: Arch is the primary target, but keep it generic enough.
    return f"On Arch Linux:  sudo pacman -S {pkg}"


def _default_output_dir() -> str:
    """Conventional downloads dir per OS (~/Movies on macOS, ~/Videos elsewhere)."""
    base = "Movies" if IS_MAC else "Videos"
    return str(Path.home() / base / "nsfw-dl")


def open_path(path: str) -> bool:
    """Open a folder/file in the OS file manager. Returns True on success."""
    try:
        if IS_MAC:
            subprocess.Popen(["open", path],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        if IS_WIN:
            os.startfile(path)  # type: ignore[attr-defined]
            return True
        # Linux: try the common openers in order.
        for tool in ("xdg-open", "gio", "nautilus", "dolphin", "thunar", "pcmanfm"):
            if shutil.which(tool):
                args = [tool, "open", path] if tool == "gio" else [tool, path]
                subprocess.Popen(args, stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL)
                return True
    except Exception:
        return False
    return False


# ---------------------------------------------------------------------------
# yt-dlp helpers
# ---------------------------------------------------------------------------
def ytdlp_binary() -> str:
    """Find the yt-dlp binary on PATH."""
    found = shutil.which("yt-dlp")
    if found:
        return found
    for cand in ("/usr/bin/yt-dlp", "/usr/local/bin/yt-dlp",
                 str(Path.home() / ".local" / "bin" / "yt-dlp")):
        if Path(cand).exists():
            return cand
    return "yt-dlp"  # let subprocess report the error


def ytdlp_installed() -> bool:
    """True if the yt-dlp binary can actually be invoked."""
    try:
        out = subprocess.run([ytdlp_binary(), "--version"],
                             capture_output=True, text=True, timeout=15)
        return out.returncode == 0
    except (FileNotFoundError, OSError):
        return False


def ytdlp_version() -> str | None:
    try:
        out = subprocess.run([ytdlp_binary(), "--version"],
                             capture_output=True, text=True, timeout=15)
        return (out.stdout or out.stderr).strip().splitlines()[0]
    except Exception:
        return None


# Cached capability probes (computed once per process).
_HOMEBREW_CACHE: dict[str, bool] = {}
_IMPERSONATE_CACHE: dict[str, bool] = {}


def ytdlp_is_homebrew() -> bool:
    """True if the yt-dlp binary lives inside a Homebrew prefix (self-update via
    `yt-dlp -U` is blocked for managed installs)."""
    if "v" in _HOMEBREW_CACHE:
        return _HOMEBREW_CACHE["v"]
    result = False
    try:
        real = Path(ytdlp_binary()).resolve()
        parts = real.parts
        if "Cellar" in parts or "homebrew" in (p.lower() for p in parts):
            result = True
        else:
            prefix = os.environ.get("HOMEBREW_PREFIX")
            if not prefix and shutil.which("brew"):
                try:
                    prefix = subprocess.run(["brew", "--prefix"],
                                            capture_output=True, text=True,
                                            timeout=10).stdout.strip()
                except Exception:
                    prefix = ""
            if prefix and str(real).startswith(prefix):
                result = True
    except Exception:
        result = False
    _HOMEBREW_CACHE["v"] = result
    return result


def ytdlp_supports_impersonate() -> bool:
    """True if this yt-dlp build can `--impersonate` (needs curl_cffi). Cached.
    When unsupported, passing --impersonate makes yt-dlp error out, so callers
    should skip the flag instead."""
    if "v" in _IMPERSONATE_CACHE:
        return _IMPERSONATE_CACHE["v"]
    result = False
    try:
        out = subprocess.run([ytdlp_binary(), "--list-impersonate-targets"],
                             capture_output=True, text=True, timeout=20)
        # Non-zero exit or empty list => not supported.
        # Also check that at least one target is NOT "unavailable".
        if out.returncode == 0 and out.stdout.strip():
            lines = [l for l in out.stdout.splitlines()
                     if l.strip() and not l.startswith("[")]
            # Lines like "Chrome  -  curl_cffi (unavailable)"
            available = [l for l in lines
                         if "unavailable" not in l.lower()
                         and l.strip()
                         and not l.startswith("-")
                         and not l.startswith("Client")]
            result = bool(available)
    except Exception:
        result = False
    _IMPERSONATE_CACHE["v"] = result
    return result


def update_ytdlp(quiet: bool = False) -> bool:
    """Update yt-dlp. Returns True if up to date / nothing to do.

    `yt-dlp -U` only works for the standalone binary; Homebrew (and distro)
    packages are managed externally and `-U` errors out. For managed installs
    we skip the self-update and point the user at the right command instead of
    surfacing a confusing failure.
    """
    if not ytdlp_installed():
        if not quiet:
            _err("yt-dlp is not installed.")
            _err(install_hint("yt-dlp"))
        return False

    if ytdlp_is_homebrew():
        # Managed by Homebrew: self-update is blocked, but this is not an error.
        if not quiet:
            _log("yt-dlp is managed by Homebrew; skipping self-update.")
            _log("To update:  brew upgrade yt-dlp")
        return True

    cmd = [ytdlp_binary(), "-U"]
    if not quiet:
        _log("Updating yt-dlp ...")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if proc.returncode == 0:
            if not quiet:
                _log("yt-dlp is up to date.")
            return True
        # Non-zero exit
        if not quiet:
            err = (proc.stderr or proc.stdout or "").strip()
            tail = err.splitlines()[-1] if err else f"exit {proc.returncode}"
            _err(f"Update failed: {tail}")
        return False
    except subprocess.TimeoutExpired:
        if not quiet:
            _err("Update timed out (120s).")
        return False
    except Exception as exc:
        if not quiet:
            _err(f"Update failed: {exc}")
        return False


def plugin_installed(name: str = YT_DLP_PLUGIN_PKG) -> bool:
    """Check if a yt-dlp plugin (pip) is installed."""
    try:
        out = subprocess.run([sys.executable, "-m", "pip", "show", name],
                             capture_output=True, text=True, timeout=20)
        return out.returncode == 0
    except (FileNotFoundError, OSError):
        return False


def install_plugin(name: str = YT_DLP_PLUGIN_PKG) -> bool:
    """Install a yt-dlp plugin via pip (Arch's python-yt-dlp doesn't bundle plugins)."""
    if plugin_installed(name):
        return True
    # Try with --user first (no system modification)
    cmds = [
        [sys.executable, "-m", "pip", "install", "--user", "--upgrade", name],
        [sys.executable, "-m", "pip", "install", "--user",
         "--break-system-packages", "--upgrade", name],
        [sys.executable, "-m", "pip", "install",
         "--break-system-packages", "--upgrade", name],
    ]
    _log(f"Installing {name} ...")
    last_err = ""
    for cmd in cmds:
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
            if proc.returncode == 0:
                return plugin_installed(name)
            last_err = (proc.stderr or proc.stdout or "").strip()
            # "externally-managed-environment" -> try next with --break-system-packages
            if "externally-managed-environment" not in last_err and \
               "Break" not in last_err:
                break
        except subprocess.TimeoutExpired:
            _err("pip install timed out (180s).")
            return False
        except FileNotFoundError:
            _err("python/pip not found. " + install_hint("python-pip"))
            return False
    _err(f"pip install failed: {last_err.splitlines()[-1] if last_err else 'unknown error'}")
    _err("Try manually:  python -m pip install --user yt-dlp-plugin-yellow")
    return False


# ---------------------------------------------------------------------------
# URL validation
# ---------------------------------------------------------------------------
def is_valid_url(url: str) -> bool:
    if not url or not isinstance(url, str):
        return False
    url = url.strip()
    return bool(URL_RE.match(url))


def detect_site(url: str) -> SiteConfig | None:
    if not url:
        return None
    try:
        host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    except Exception:
        return None
    if not host:
        return None
    for domain, cfg in KNOWN_SITES.items():
        if host == domain or host.endswith("." + domain):
            return cfg
    return None


def site_label(url: str) -> str:
    cfg = detect_site(url)
    if cfg:
        return cfg.name
    if not url.strip():
        return ""
    return "Generic"


# ---------------------------------------------------------------------------
# Settings (JSON)
# ---------------------------------------------------------------------------
DEFAULT_SETTINGS: dict[str, Any] = {
    "output_dir": _default_output_dir(),
    "quality": "best",
    "cookies_browser": "none",
    "embed_metadata": True,
    "embed_thumbnail": True,
    "embed_subtitles": False,
    "concurrent_downloads": 2,
    "auto_update_ytdlp": True,
    "use_impersonate": True,
    "filename_template": "%(title)s [%(id)s].%(ext)s",
    "restrict_filenames": True,
    "download_archive": True,
    "verbose_logging": False,
    "notify_on_complete": True,
    "open_folder_on_complete": False,
    "window_width": 1100,
    "window_height": 760,
}


def load_settings() -> dict[str, Any]:
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        if CONFIG_FILE.exists():
            data = json.loads(CONFIG_FILE.read_text("utf-8"))
            return {**DEFAULT_SETTINGS, **data}
    except json.JSONDecodeError as exc:
        _err(f"Settings JSON invalid: {exc}")
    except Exception as exc:
        _err(f"Could not load settings: {exc}")
    return dict(DEFAULT_SETTINGS)


def save_settings(cfg: dict[str, Any]) -> bool:
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_FILE.write_text(json.dumps(cfg, indent=2, ensure_ascii=False))
        return True
    except Exception as exc:
        _err(f"Could not save settings: {exc}")
        return False


def ensure_output_dir(out_dir: str) -> str:
    """Make sure the output directory exists; fallback to the OS default dir."""
    try:
        p = Path(out_dir).expanduser()
        p.mkdir(parents=True, exist_ok=True)
        # Test writability
        test = p / ".nsfw-dl-write-test"
        test.write_text("ok")
        test.unlink()
        return str(p)
    except Exception:
        fallback = Path(_default_output_dir())
        fallback.mkdir(parents=True, exist_ok=True)
        _err(f"Output dir '{out_dir}' not writable, using {fallback}")
        return str(fallback)


# ---------------------------------------------------------------------------
# Build yt-dlp options dict
# ---------------------------------------------------------------------------
def build_ydl_opts(url: str, settings: dict[str, Any]) -> dict[str, Any]:
    out_dir = ensure_output_dir(settings.get("output_dir")
                                 or DEFAULT_SETTINGS["output_dir"])
    quality = settings.get("quality", "best")
    fmt = FORMAT_PRESETS.get(quality, FORMAT_PRESETS["best"])
    template = settings.get("filename_template",
                            DEFAULT_SETTINGS["filename_template"])

    opts: dict[str, Any] = {
        "format": fmt,
        "outtmpl": str(Path(out_dir) / template),
        "noplaylist": True,
        "merge_output_format": "mp4",
        "restrictfilenames": bool(settings.get("restrict_filenames", True)),
        "writethumbnail": bool(settings.get("embed_thumbnail", True)),
        "postprocessors": [],
        "quiet": False,
        "no_warnings": False,
        "ignoreerrors": False,
        "retries": 3,
        "fragment_retries": 3,
        "concurrent_fragment_downloads": 4,
    }

    if settings.get("embed_metadata", True):
        opts["postprocessors"].append({
            "key": "FFmpegMetadata",
            "add_chapters": True,
        })

    if settings.get("embed_thumbnail", True):
        opts["postprocessors"].append({
            "key": "EmbedThumbnail",
            "already_have_thumbnail": False,
        })

    if settings.get("embed_subtitles", False):
        opts["writesubtitles"] = True
        opts["subtitleslangs"] = ["en.*", "all"]

    if settings.get("download_archive", True):
        archive = Path(out_dir) / ".downloaded.txt"
        opts["download_archive"] = str(archive)

    if settings.get("verbose_logging", False):
        opts["verbose"] = True

    cb = (settings.get("cookies_browser") or "none").lower()
    if cb and cb != "none":
        opts["cookiesfrombrowser"] = (cb,)

    # Site-specific tweaks
    cfg = detect_site(url)
    if cfg:
        if cfg.referer:
            opts["referer"] = cfg.referer
        if cfg.impersonate and settings.get("use_impersonate", True):
            # Pass as string; both yt-dlp Python API and CLI accept strings.
            # Python API will auto-convert. CLI requires literal string.
            opts["impersonate"] = "chrome"

    # NOTE: yt-dlp's Python API requires an ImpersonateTarget object, not a
    # string, when running via the Python module. The CLI accepts strings.
    # We pass the string here, and run_download() converts it for the
    # Python API path.
    return opts


# ---------------------------------------------------------------------------
# Download job
# ---------------------------------------------------------------------------
@dataclass
class JobResult:
    url: str
    ok: bool
    title: str = ""
    filename: str = ""
    error: str = ""


def _find_downloaded_file(url: str, settings: dict[str, Any],
                          started_at: float | None = None) -> str | None:
    """Best-effort: find the most recently finished file in the output dir.

    Only used as a fallback when yt-dlp raised during post-processing but a file
    may still have landed. `started_at` narrows the window to files touched since
    this job began, which reduces (but cannot fully eliminate) mis-attribution
    when several downloads run concurrently into the same directory.
    """
    try:
        out_dir = Path(settings.get("output_dir")
                       or DEFAULT_SETTINGS["output_dir"])
        out_dir.mkdir(parents=True, exist_ok=True)
        # Consider files modified since the job started (default: last 5 min).
        candidates: list[tuple[float, Path]] = []
        cutoff = started_at if started_at is not None else time.time() - 300
        for p in out_dir.iterdir():
            try:
                if p.is_file() and p.stat().st_mtime >= cutoff:
                    # Skip our own metadata files
                    if p.name.startswith(".") or p.suffix in (".part", ".ytdl"):
                        continue
                    candidates.append((p.stat().st_mtime, p))
            except OSError:
                continue
        if not candidates:
            return None
        # Return most recent
        candidates.sort(reverse=True)
        return str(candidates[0][1])
    except Exception:
        return None


def run_download(url: str, settings: dict[str, Any],
                 on_progress=None, on_log=None,
                 cancel_flag: threading.Event | None = None) -> JobResult:
    """
    Run a single download via yt-dlp Python module (preferred) or subprocess.

    Callbacks (called from worker thread):
      on_progress(d: dict) -> None   yt-dlp progress hook payload
      on_log(line: str) -> None      textual log line
    """
    res = JobResult(url=url, ok=False)
    if on_log:
        on_log(f"-> {url}")

    # Plugin gate
    cfg = detect_site(url)
    if cfg and cfg.needs_plugin and not plugin_installed(cfg.needs_plugin):
        msg = (f"Site {cfg.name} requires plugin '{cfg.needs_plugin}'. "
               f"Install with: nsfw-dl --install-plugin")
        if on_log:
            on_log("!! " + msg)
        res.error = msg
        return res

    opts = build_ydl_opts(url, settings)
    started_at = time.time()

    # Try Python module first (richer hooks)
    try:
        import yt_dlp  # type: ignore
    except ImportError:
        yt_dlp = None  # noqa: N816

    if yt_dlp is not None:
        # Convert impersonate string to ImpersonateTarget for Python API
        if "impersonate" in opts and isinstance(opts["impersonate"], str):
            try:
                target, _ = yt_dlp.YoutubeDL({})._parse_impersonate_targets(
                    opts["impersonate"])
                if target is not None:
                    opts["impersonate"] = target
                else:
                    del opts["impersonate"]  # not available, skip silently
            except Exception:
                # If conversion fails, just remove impersonate
                # (CLI path will still try, but Python API can't use string)
                if "impersonate" in opts:
                    del opts["impersonate"]

        class _Cancel(Exception):
            pass

        def _hook(d: dict[str, Any]) -> None:
            if cancel_flag is not None and cancel_flag.is_set():
                raise _Cancel()
            if on_progress:
                on_progress(d)
            status = d.get("status")
            if status == "downloading":
                pct = d.get("_percent_str", "").strip()
                spd = d.get("_speed_str", "").strip()
                eta = d.get("_eta_str", "").strip()
                fn = d.get("filename", "")
                if on_log and pct:
                    on_log(f"   {pct}  {spd}  ETA {eta}  {Path(fn).name}")
            elif status == "finished":
                if on_log:
                    on_log("   post-processing ...")

        class _QuietLogger:
            def debug(self, msg):
                if on_log and settings.get("verbose_logging", False):
                    on_log(f"[dbg] {msg}")
            def info(self, msg):
                if on_log:
                    on_log(f"[info] {msg}")
            def warning(self, msg):
                if on_log:
                    on_log(f"[warn] {msg}")
            def error(self, msg):
                if on_log:
                    on_log(f"[err ] {msg}")

        ydl = yt_dlp.YoutubeDL({**opts, "logger": _QuietLogger(),
                                "progress_hooks": [_hook]})
        try:
            info = ydl.extract_info(url, download=True)
            if isinstance(info, dict):
                res.title = info.get("title", "") or ""
                if info.get("_filename"):
                    res.filename = str(info["_filename"])
                elif info.get("requested_downloads"):
                    rd = info["requested_downloads"][0]
                    res.filename = str(rd.get("filepath") or rd.get("filename") or "")
            res.ok = True
            if on_log:
                on_log(f"OK -> {res.filename or res.title or url}")
        except _Cancel:
            res.error = "cancelled"
            if on_log:
                on_log("!! cancelled by user")
        except Exception as exc:  # noqa: BLE001
            # yt-dlp may raise during post-processing (e.g., metadata
            # embedding when ffprobe fails). If the actual file was
            # downloaded successfully, treat it as success with a warning.
            err_text = str(exc)
            # Try to find the downloaded file
            downloaded_file = _find_downloaded_file(url, settings, started_at)
            if downloaded_file and Path(downloaded_file).exists() \
                    and Path(downloaded_file).stat().st_size > 0:
                res.ok = True
                res.filename = downloaded_file
                if on_log:
                    on_log(f"OK -> {downloaded_file}")
                    on_log(f"   (warning: post-processing failed: {err_text[:200]})")
            else:
                res.error = err_text
                if on_log:
                    on_log(f"!! error: {err_text}")
        return res

    # Fallback: subprocess
    if not ytdlp_installed():
        msg = "yt-dlp not installed. " + install_hint("yt-dlp")
        if on_log:
            on_log("!! " + msg)
        res.error = msg
        return res

    if on_log:
        on_log("(yt-dlp python module not found, using subprocess fallback)")
    cmd = [ytdlp_binary()]
    cmd += ["-f", opts["format"]]
    cmd += ["-o", opts["outtmpl"]]
    cmd += ["--merge-output-format", opts.get("merge_output_format", "mp4")]
    cmd += ["--no-playlist"]
    cmd += ["--retries", str(opts.get("retries", 3))]
    cmd += ["--fragment-retries", str(opts.get("fragment_retries", 3))]
    cmd += ["--concurrent-fragments",
            str(opts.get("concurrent_fragment_downloads", 4))]
    cmd += ["--legacy-server-connect"]
    cmd += ["--user-agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"]
    # NOTE: build_ydl_opts expresses metadata/thumbnail/subtitles as Python-API
    # constructs (postprocessors / writethumbnail / writesubtitles), NOT as
    # opts["embed_metadata"] etc. The subprocess path must therefore read the
    # user's *settings* directly, otherwise these flags silently never apply.
    if settings.get("restrict_filenames", True):
        cmd.append("--restrict-filenames")
    if settings.get("embed_metadata", True):
        cmd += ["--embed-metadata", "--add-metadata"]
    if settings.get("embed_thumbnail", True):
        cmd += ["--write-thumbnail",
                "--convert-thumbnails", "jpg"]
    if settings.get("embed_subtitles", False):
        cmd += ["--write-subs", "--sub-langs", "en.*,all", "--embed-subs"]
    if settings.get("verbose_logging", False):
        cmd.append("--verbose")
    if opts.get("download_archive"):
        cmd += ["--download-archive", opts["download_archive"]]
    if opts.get("referer"):
        cmd += ["--referer", opts["referer"]]
    # Only pass --impersonate if this yt-dlp build actually supports it
    # (needs curl_cffi); otherwise the command errors out and the download
    # fails for sites that don't strictly require it.
    if opts.get("impersonate") and settings.get("use_impersonate", True):
        if ytdlp_supports_impersonate():
            cmd += ["--impersonate", "chrome"]
        elif on_log:
            on_log("   (impersonate not supported by this yt-dlp build, skipping; "
                   "install curl_cffi for sites that need it)")
    cb = (settings.get("cookies_browser") or "none").lower()
    if cb and cb != "none":
        cmd += ["--cookies-from-browser", cb]
    cmd.append(url)
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
        if proc.returncode == 0:
            res.ok = True
            if on_log:
                on_log("OK")
        else:
            err_out = (proc.stderr or proc.stdout or "").strip()
            # Check if video was downloaded despite post-processing error
            # (e.g. thumbnail embed failed but video is fine)
            out_dir = Path(settings.get("output_dir")
                           or DEFAULT_SETTINGS["output_dir"])
            recent_mp4s = sorted(
                (p for p in out_dir.glob("*.mp4")
                 if p.is_file() and p.stat().st_size > 0
                 and time.time() - p.stat().st_mtime < 600),
                key=lambda p: p.stat().st_mtime, reverse=True)
            if recent_mp4s:
                res.ok = True
                res.filename = str(recent_mp4s[0])
                if on_log:
                    on_log(f"OK -> {res.filename}")
                    if err_out:
                        on_log(f"   (warning: post-processing issue: "
                               f"{err_out[-200:]})")
            else:
                res.error = err_out[-400:] if err_out else f"exit {proc.returncode}"
                if on_log:
                    on_log(f"!! error (exit {proc.returncode}): {res.error}")
    except subprocess.TimeoutExpired:
        res.error = "download timed out (1h)"
        if on_log:
            on_log("!! " + res.error)
    except Exception as exc:
        res.error = str(exc)
        if on_log:
            on_log(f"!! {exc}")
    return res


# ---------------------------------------------------------------------------
# Format preview (used by GUI)
# ---------------------------------------------------------------------------
def fetch_formats(url: str, settings: dict[str, Any],
                  timeout: int = 45) -> tuple[bool, str]:
    """Run `yt-dlp -F URL` and return (ok, output)."""
    if not is_valid_url(url):
        return False, "Invalid URL"
    cfg = detect_site(url)
    cmd = [ytdlp_binary(), "-F", url]
    cmd += ["--legacy-server-connect"]
    cmd += ["--user-agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"]
    if cfg and cfg.referer:
        cmd += ["--referer", cfg.referer]
    if cfg and cfg.impersonate and settings.get("use_impersonate", True) \
            and ytdlp_supports_impersonate():
        cmd += ["--impersonate", "chrome"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        out = (proc.stdout or "") + (proc.stderr or "")
        return proc.returncode == 0, out
    except subprocess.TimeoutExpired:
        return False, f"Timeout after {timeout}s"
    except FileNotFoundError:
        return False, "yt-dlp not installed"
    except Exception as exc:
        return False, str(exc)


# ---------------------------------------------------------------------------
# CLI mode
# ---------------------------------------------------------------------------
def cli_list_sites() -> None:
    print("Known (tweaked) sites:")
    for d, c in KNOWN_SITES.items():
        notes = []
        if c.referer:      notes.append("referer")
        if c.impersonate:  notes.append("impersonate")
        if c.needs_plugin: notes.append(f"plugin:{c.needs_plugin}")
        if c.needs_cookies: notes.append("cookies")
        print(f"  {d:<22}  {c.name:<14}  {','.join(notes)}")
    print()
    v = ytdlp_version()
    print(f"yt-dlp version:   {v or '(not found)'}")
    print(f"MissAV plugin:    {'installed' if plugin_installed() else 'not installed'}")
    print(f"Config file:      {CONFIG_FILE}")


def cli_check_url(url: str) -> int:
    """Check whether a URL is supported by yt-dlp."""
    if not is_valid_url(url):
        _err(f"Not a valid URL: {url}")
        return 2
    if not ytdlp_installed():
        _err("yt-dlp not installed")
        return 3
    _log(f"Checking: {url}")
    try:
        proc = subprocess.run([ytdlp_binary(), "--dump-json", url],
                              capture_output=True, text=True, timeout=60)
        if proc.returncode == 0:
            try:
                info = json.loads(proc.stdout.splitlines()[0])
                title = info.get("title", "(no title)")
                dur = info.get("duration")
                uploader = info.get("uploader") or info.get("channel", "")
                _log(f"OK")
                _log(f"  title:    {title}")
                if uploader:
                    _log(f"  uploader: {uploader}")
                if dur:
                    _log(f"  duration: {dur}s")
                return 0
            except (json.JSONDecodeError, IndexError) as exc:
                _err(f"Parse error: {exc}")
                return 1
        err = (proc.stderr or "").strip()
        _err(f"Not supported / error: {err.splitlines()[-1] if err else 'unknown'}")
        return 1
    except subprocess.TimeoutExpired:
        _err("Check timed out")
        return 1
    except Exception as exc:
        _err(f"Check failed: {exc}")
        return 1


def cli_main(args: argparse.Namespace) -> int:
    settings = load_settings()

    if args.output:
        settings["output_dir"] = args.output
    if args.quality:
        settings["quality"] = args.quality
    if args.cookies:
        settings["cookies_browser"] = args.cookies
    if args.embed_meta:
        settings["embed_metadata"] = True
    if args.embed_thumb:
        settings["embed_thumbnail"] = True
    if args.no_meta:
        settings["embed_metadata"] = False
    if args.no_thumb:
        settings["embed_thumbnail"] = False
    if args.verbose:
        settings["verbose_logging"] = True
    if args.no_archive:
        settings["download_archive"] = False

    # Parse and validate URLs
    raw_urls = [u.strip() for u in args.url.split(",") if u.strip()]
    if not raw_urls:
        _err("No URLs given. Use --help for usage.")
        return 2

    valid_urls: list[str] = []
    invalid_urls: list[str] = []
    for u in raw_urls:
        if is_valid_url(u):
            valid_urls.append(u)
        else:
            invalid_urls.append(u)

    if invalid_urls:
        _err("Invalid URLs (must start with http:// or https://):")
        for u in invalid_urls:
            _err(f"  {u}")
        if not valid_urls:
            return 2
        _err("Continuing with the valid ones ...")

    save_settings(settings)

    if settings.get("auto_update_ytdlp", True):
        update_ytdlp(quiet=True)

    results: list[JobResult] = []
    max_workers = max(1, int(settings.get("concurrent_downloads", 2)))
    if max_workers == 1 or len(valid_urls) == 1:
        for u in valid_urls:
            results.append(run_download(u, settings, on_log=_log))
    else:
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            futs: list[Future] = [ex.submit(run_download, u, settings, None, _log)
                                  for u in valid_urls]
            for f in futs:
                results.append(f.result())

    print()
    print("=" * 60)
    print(f"Summary: {sum(r.ok for r in results)}/{len(results)} succeeded")
    for r in results:
        status = "OK " if r.ok else "ERR"
        print(f"  [{status}] {r.url}")
        if not r.ok and r.error:
            print(f"         {r.error[:200]}")
    return 0 if all(r.ok for r in results) else 1


# ---------------------------------------------------------------------------
# GUI mode
# ---------------------------------------------------------------------------
def gui_main() -> int:
    HAS_ADW = False
    try:
        import gi
        gi.require_version("Gtk", "4.0")
        gi.require_version("Adw", "1")
        from gi.repository import Gtk, Adw, GLib, Gio, GObject  # noqa: F401
        HAS_ADW = True
    except (ImportError, ValueError):
        try:
            import gi
            gi.require_version("Gtk", "4.0")
            from gi.repository import Gtk, GLib, Gio, GObject  # noqa: F401
        except (ImportError, ValueError) as exc:
            print(f"\n!! Could not load GTK4 Python bindings: {exc}",
                  file=sys.stderr)
            print("   " + install_hint("pygobject3 gtk4")
                  if IS_MAC else
                  "   On Arch Linux:  sudo pacman -S python-gobject gtk4 libadwaita",
                  file=sys.stderr)
            return 1

    # ---- GTK4-only helper factories (used when HAS_ADW is False) ------

    def _make_header_bar():
        if HAS_ADW:
            return Adw.HeaderBar()
        hb = Gtk.HeaderBar()
        return hb

    def _make_clamp(child, max_size=1100, threshold=900):
        if HAS_ADW:
            c = Adw.Clamp(maximum_size=max_size, tightening_threshold=threshold)
            c.set_child(child)
            return c
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        box.set_halign(Gtk.Align.CENTER)
        box.set_size_request(-1, -1)
        child.set_size_request(max_size, -1)
        box.append(child)
        return box

    def _make_status_page(title, description, icon_name):
        if HAS_ADW:
            return Adw.StatusPage(title=title, description=description,
                                  icon_name=icon_name)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        box.set_valign(Gtk.Align.CENTER)
        box.set_vexpand(True)
        img = Gtk.Image.new_from_icon_name(icon_name)
        img.set_pixel_size(48)
        box.append(img)
        lbl = Gtk.Label(label=title)
        lbl.add_css_class("title-2")
        box.append(lbl)
        if description:
            dlbl = Gtk.Label(label=description)
            dlbl.add_css_class("dim-label")
            dlbl.set_wrap(True)
            box.append(dlbl)
        return box

    def _make_switch_row(title, subtitle="", active=False):
        if HAS_ADW:
            row = Adw.SwitchRow(title=title, subtitle=subtitle)
            row.set_active(active)
            return row, row
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        box.set_margin_top(4)
        box.set_margin_bottom(4)
        labels = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        tl = Gtk.Label(label=title, xalign=0)
        tl.add_css_class("heading")
        labels.append(tl)
        if subtitle:
            sl = Gtk.Label(label=subtitle, xalign=0)
            sl.add_css_class("dim-label")
            sl.add_css_class("caption")
            labels.append(sl)
        box.append(labels)
        spacer = Gtk.Box()
        spacer.set_hexpand(True)
        box.append(spacer)
        sw = Gtk.Switch()
        sw.set_active(active)
        sw.set_valign(Gtk.Align.CENTER)
        box.append(sw)
        return box, sw

    def _make_combo_row(title, options, selected_idx=0):
        if HAS_ADW:
            row = Adw.ComboRow(title=title)
            row.set_model(Gtk.StringList.new(options))
            row.set_selected(selected_idx)
            return row, row
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        box.set_margin_top(4)
        box.set_margin_bottom(4)
        lbl = Gtk.Label(label=title, xalign=0)
        lbl.set_size_request(160, -1)
        box.append(lbl)
        combo = Gtk.ComboBoxText()
        for i, opt in enumerate(options):
            combo.append(str(i), opt)
        combo.set_active(selected_idx)
        box.append(combo)
        return box, combo

    def _make_spin_row(title, min_val, max_val, step, value):
        if HAS_ADW:
            row = Adw.SpinRow.new_with_range(min_val, max_val, step)
            row.set_title(title)
            row.set_value(value)
            return row, row
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        box.set_margin_top(4)
        box.set_margin_bottom(4)
        lbl = Gtk.Label(label=title, xalign=0)
        lbl.set_size_request(160, -1)
        box.append(lbl)
        spin = Gtk.SpinButton.new_with_range(min_val, max_val, step)
        spin.set_value(value)
        box.append(spin)
        return box, spin

    def _make_action_row(title, subtitle="", suffix_widget=None):
        if HAS_ADW:
            row = Adw.ActionRow(title=title, subtitle=subtitle)
            if suffix_widget:
                row.add_suffix(suffix_widget)
            return row, row
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        box.set_margin_top(4)
        box.set_margin_bottom(4)
        tl = Gtk.Label(label=title, xalign=0)
        tl.add_css_class("heading")
        box.append(tl)
        if subtitle:
            sl = Gtk.Label(label=subtitle, xalign=0)
            sl.add_css_class("dim-label")
            sl.add_css_class("caption")
            box.append(sl)
        if suffix_widget:
            hb = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
            spacer = Gtk.Box()
            spacer.set_hexpand(True)
            hb.append(spacer)
            hb.append(suffix_widget)
            box.append(hb)
        return box, box

    def _make_group(title):
        if HAS_ADW:
            return Adw.PreferencesGroup(title=title)
        frame = Gtk.Frame()
        frame.set_margin_top(8)
        frame.set_margin_bottom(8)
        lbl = Gtk.Label(label=title, xalign=0)
        lbl.add_css_class("heading")
        lbl.set_margin_start(12)
        lbl.set_margin_top(8)
        lbl.set_margin_bottom(4)
        inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        inner.append(lbl)
        sep = Gtk.Separator()
        sep.set_margin_start(12)
        sep.set_margin_end(12)
        inner.append(sep)
        frame.set_child(inner)
        return frame

    def _group_add(group, child):
        if HAS_ADW:
            group.add(child)
        elif isinstance(group, Gtk.Frame):
            group.get_child().append(child)
        else:
            group.append(child)

    def _make_message_dialog(parent, heading, body):
        if HAS_ADW:
            return Adw.MessageDialog(transient_for=parent, modal=True,
                                     heading=heading, body=body)
        dlg = Gtk.AlertDialog()
        dlg.set_message(heading)
        dlg.set_detail(body)
        return dlg

    def _make_about_dialog(app):
        if HAS_ADW:
            return Adw.AboutWindow(
                transient_for=app.props.active_window,
                application_name="nsfw-dl",
                application_icon="folder-download-symbolic",
                developer_name="nsfw-dl contributors",
                version=APP_VERSION,
                comments=("A GTK4 video downloader for Linux "
                          "(Hyprland) and macOS. Backend: yt-dlp."),
                website="https://github.com/yt-dlp/yt-dlp",
                license_type=Gtk.License.MIT_X11,
            )
        about = Gtk.AboutDialog()
        about.set_transient_for(app.props.active_window)
        about.set_program_name("nsfw-dl")
        about.set_version(APP_VERSION)
        about.set_comments("A GTK4 video downloader for Linux (Hyprland) "
                           "and macOS. Backend: yt-dlp.")
        about.set_website("https://github.com/yt-dlp/yt-dlp")
        about.set_license_type(Gtk.License.MIT_X11)
        return about

    # ---- DownloadRow -------------------------------------------------
    class DownloadRow(Gtk.ListBoxRow):
        def __init__(self, url: str, site: str, parent: "MainWindow"):
            super().__init__()
            self.parent = parent
            self.url = url
            self.site = site
            self.cancel_event = threading.Event()
            self.future: Future | None = None
            self.status = "Queued"
            self.progress = 0.0
            self.title = url

            outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
            outer.set_margin_top(4)
            outer.set_margin_bottom(4)

            row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
            row.set_margin_start(12)
            row.set_margin_end(12)

            self.status_icon = Gtk.Image.new_from_icon_name(
                "media-playback-start-symbolic")
            self.status_icon.set_pixel_size(16)
            row.append(self.status_icon)

            info = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
            info.set_hexpand(True)
            self.title_label = Gtk.Label(label=url, xalign=0,
                                         ellipsize=3, max_width_chars=70)
            info.append(self.title_label)
            self.site_label = Gtk.Label(label=site, xalign=0)
            self.site_label.add_css_class("dim-label")
            self.site_label.add_css_class("caption")
            info.append(self.site_label)
            row.append(info)

            self.status_label = Gtk.Label(label="Queued")
            self.status_label.add_css_class("dim-label")
            self.status_label.add_css_class("caption")
            row.append(self.status_label)

            self.cancel_btn = Gtk.Button.new_from_icon_name("process-stop-symbolic")
            self.cancel_btn.set_tooltip_text("Cancel")
            self.cancel_btn.set_size_request(32, 32)
            self.cancel_btn.connect("clicked", self._on_cancel)
            row.append(self.cancel_btn)

            outer.append(row)

            self.progress_bar = Gtk.ProgressBar()
            self.progress_bar.set_margin_start(12)
            self.progress_bar.set_margin_end(12)
            self.progress_bar.set_margin_top(2)
            self.progress_bar.set_margin_bottom(2)
            self.progress_bar.set_show_text(True)
            outer.append(self.progress_bar)

            self.set_child(outer)

        def _on_cancel(self, *_):
            self.cancel_event.set()
            self.parent._log(f"Cancel requested for {self.url}")

        def update_progress(self, frac: float, text: str = ""):
            self.progress = max(0.0, min(1.0, frac))
            GLib.idle_add(self.progress_bar.set_fraction, self.progress)
            if text:
                GLib.idle_add(self.progress_bar.set_text, text)

        def set_status(self, status: str):
            self.status = status
            icon_map = {
                "Queued":    "media-playback-start-symbolic",
                "Running":   "media-playback-start-symbolic",
                "Done":      "object-select-symbolic",
                "Error":     "dialog-error-symbolic",
                "Cancelled": "process-stop-symbolic",
            }
            GLib.idle_add(self.status_icon.set_from_icon_name,
                          icon_map.get(status, "media-playback-start-symbolic"))
            GLib.idle_add(self.status_label.set_text, status)

        def set_title(self, title: str):
            if title and title != self.url:
                GLib.idle_add(self.title_label.set_text, title)

    # ---- SettingsDialog ----------------------------------------------
    class SettingsDialog(Gtk.Window if not HAS_ADW else Adw.PreferencesWindow):
        def __init__(self, parent: "MainWindow", settings: dict[str, Any]):
            if HAS_ADW:
                super().__init__(transient_for=parent, modal=True,
                                 title="Settings",
                                 default_width=560, default_height=720)
            else:
                super().__init__(transient_for=parent, modal=True,
                                 title="Settings",
                                 default_width=560, default_height=720)

            self._settings_ref = settings
            self.cb_options = BROWSER_OPTIONS

            if HAS_ADW:
                page = Adw.PreferencesPage()
                self.add(page)
            else:
                page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
                scroll = Gtk.ScrolledWindow()
                scroll.set_child(page)
                scroll.set_vexpand(True)
                self.set_child(scroll)

            # Downloads group
            grp_dl = _make_group("Downloads")
            _group_add(page, grp_dl)

            dir_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
            self.dir_btn = Gtk.Button(label="Browse ...")
            self.dir_btn.set_valign(Gtk.Align.CENTER)
            self.dir_btn.connect("clicked", self._pick_dir)
            self.dir_label = Gtk.Label(label=settings["output_dir"])
            self.dir_label.set_ellipsize(3)
            self.dir_label.set_max_width_chars(40)
            dir_box.append(self.dir_label)
            dir_box.append(self.dir_btn)
            row_dir, _ = _make_action_row("Output folder",
                                          "Where downloaded files are saved",
                                          dir_box)
            _group_add(grp_dl, row_dir)

            qidx = self._safe_index(QUALITY_LABELS, settings.get("quality", "best"))
            row_q_box, self.row_q = _make_combo_row("Default quality",
                                                    QUALITY_LABELS, qidx)
            _group_add(grp_dl, row_q_box)

            cidx = self._safe_index(self.cb_options,
                                    settings.get("cookies_browser", "none"))
            row_c_box, self.row_c = _make_combo_row("Cookies from browser",
                                                    self.cb_options, cidx)
            _group_add(grp_dl, row_c_box)

            row_conc_box, self.row_conc = _make_spin_row(
                "Concurrent downloads", 1, 8, 1,
                int(settings.get("concurrent_downloads", 2)))
            _group_add(grp_dl, row_conc_box)

            # Embedding group
            grp_emb = _make_group("Embedding")
            _group_add(page, grp_emb)

            box, self.sw_meta = _make_switch_row(
                "Embed metadata", "Title, author, date into file",
                bool(settings.get("embed_metadata", True)))
            _group_add(grp_emb, box)

            box, self.sw_thumb = _make_switch_row(
                "Embed thumbnail", "Cover art for video / audio",
                bool(settings.get("embed_thumbnail", True)))
            _group_add(grp_emb, box)

            box, self.sw_subs = _make_switch_row(
                "Download subtitles", "English + all available",
                bool(settings.get("embed_subtitles", False)))
            _group_add(grp_emb, box)

            box, self.sw_archive = _make_switch_row(
                "Download archive", "Skip files already in archive",
                bool(settings.get("download_archive", True)))
            _group_add(grp_emb, box)

            box, self.sw_restrict = _make_switch_row(
                "Restrict filenames", "ASCII-only, no spaces",
                bool(settings.get("restrict_filenames", True)))
            _group_add(grp_emb, box)

            # Behavior group
            grp_bh = _make_group("Behavior")
            _group_add(page, grp_bh)

            box, self.sw_update = _make_switch_row(
                "Auto-update yt-dlp at startup", "",
                bool(settings.get("auto_update_ytdlp", True)))
            _group_add(grp_bh, box)

            box, self.sw_impersonate = _make_switch_row(
                "Browser impersonation",
                "Mimic Chrome when needed (recommended)",
                bool(settings.get("use_impersonate", True)))
            _group_add(grp_bh, box)

            box, self.sw_verbose = _make_switch_row(
                "Verbose logging", "Show debug output",
                bool(settings.get("verbose_logging", False)))
            _group_add(grp_bh, box)

            # Notifications group
            grp_nt = _make_group("Notifications")
            _group_add(page, grp_nt)

            box, self.sw_notify = _make_switch_row(
                "Notify on completion",
                "System notification when a download finishes",
                bool(settings.get("notify_on_complete", True)))
            _group_add(grp_nt, box)

            box, self.sw_open_finish = _make_switch_row(
                "Open output folder when all done",
                "Auto-open folder when batch finishes",
                bool(settings.get("open_folder_on_complete", False)))
            _group_add(grp_nt, box)

            # Save / Cancel buttons
            self._build_header_buttons()

        @staticmethod
        def _safe_index(lst: list[str], value: str) -> int:
            try:
                return lst.index(value)
            except ValueError:
                return 0

        def _build_header_buttons(self):
            if HAS_ADW:
                btn_cancel = Gtk.Button(label="Cancel")
                btn_cancel.connect("clicked", lambda *_: self.close())
                btn_save = Gtk.Button(label="Save")
                btn_save.add_css_class("suggested-action")
                btn_save.connect("clicked", self._save)
                self.set_default_widget(btn_save)
            else:
                hb = Gtk.HeaderBar()
                btn_cancel = Gtk.Button(label="Cancel")
                btn_cancel.connect("clicked", lambda *_: self.close())
                hb.pack_start(btn_cancel)
                btn_save = Gtk.Button(label="Save")
                btn_save.add_css_class("suggested-action")
                btn_save.connect("clicked", self._save)
                hb.pack_end(btn_save)
                self.set_titlebar(hb)

        def _pick_dir(self, *_):
            dlg = Gtk.FileDialog()
            dlg.set_title("Select output folder")
            try:
                cur = Gtk.File.new_for_path(self._settings_ref["output_dir"])
                dlg.set_initial_folder(cur)
            except Exception:
                pass
            try:
                dlg.select_folder(self.get_transient_for(), None,
                                  self._on_dir_picked)
            except Exception as exc:
                self.get_transient_for()._log(f"Folder picker failed: {exc}")

        def _on_dir_picked(self, dlg, res):
            try:
                f = dlg.select_folder_finish(res)
                if f and f.get_path():
                    self.dir_label.set_text(f.get_path())
            except Exception:
                pass

        def _save(self, *_):
            s = self._settings_ref
            s["quality"] = self._get_selected(self.row_q, QUALITY_LABELS, "best")
            s["cookies_browser"] = self._get_selected(
                self.row_c, self.cb_options, "none")
            s["concurrent_downloads"] = int(self.row_conc.get_value())
            s["embed_metadata"] = bool(self.sw_meta.get_active())
            s["embed_thumbnail"] = bool(self.sw_thumb.get_active())
            s["embed_subtitles"] = bool(self.sw_subs.get_active())
            s["download_archive"] = bool(self.sw_archive.get_active())
            s["restrict_filenames"] = bool(self.sw_restrict.get_active())
            s["auto_update_ytdlp"] = bool(self.sw_update.get_active())
            s["use_impersonate"] = bool(self.sw_impersonate.get_active())
            s["verbose_logging"] = bool(self.sw_verbose.get_active())
            s["notify_on_complete"] = bool(self.sw_notify.get_active())
            s["open_folder_on_complete"] = bool(self.sw_open_finish.get_active())
            new_dir = self.dir_label.get_text().strip()
            if new_dir and new_dir != s["output_dir"]:
                s["output_dir"] = new_dir
            save_settings(s)
            self.close()

        @staticmethod
        def _get_selected(row, options: list[str], default: str) -> str:
            idx = row.get_selected()
            if 0 <= idx < len(options):
                return options[idx]
            return default

    # ---- FormatPreviewDialog ----------------------------------------
    class FormatPreviewDialog(Gtk.Window if not HAS_ADW else Adw.MessageDialog):
        def __init__(self, parent, url: str, settings: dict[str, Any]):
            if HAS_ADW:
                super().__init__(transient_for=parent, modal=True,
                                 heading=f"Available formats for {url}",
                                 body="Fetching ...")
            else:
                super().__init__(transient_for=parent, modal=True,
                                 title=f"Formats: {url}")
                self._gtk_body = Gtk.Label(label="Fetching ...")
                self._gtk_body.set_selectable(True)
                self._gtk_body.set_wrap(True)
                self._gtk_body.set_xalign(0)
                scroll = Gtk.ScrolledWindow()
                scroll.set_child(self._gtk_body)
                scroll.set_size_request(600, 400)
                self.set_child(scroll)
                hb = Gtk.HeaderBar()
                btn_close = Gtk.Button(label="Close")
                btn_close.connect("clicked", lambda *_: self.close())
                hb.pack_end(btn_close)
                self.set_titlebar(hb)
            self._url = url
            self._settings = settings
            if HAS_ADW:
                self.add_response("close", "Close")
                self.set_default_response("close")
            threading.Thread(target=self._bg_fetch, daemon=True).start()

        def _bg_fetch(self):
            ok, text = fetch_formats(self._url, self._settings)
            if ok:
                display = text[:4000]
                if len(text) > 4000:
                    display += "\n... (truncated)"
                GLib.idle_add(self._set_body_safe, display)
            else:
                GLib.idle_add(self._set_body_safe,
                              f"Could not fetch formats:\n{text}")

        def _set_body_safe(self, body: str) -> bool:
            try:
                if HAS_ADW:
                    self.set_body(body)
                else:
                    self._gtk_body.set_text(body)
            except Exception:
                pass
            return False

    # ---- MainWindow --------------------------------------------------
    class MainWindow(Gtk.ApplicationWindow if not HAS_ADW
                     else Adw.ApplicationWindow):
        def __init__(self, app, settings: dict[str, Any]):
            super().__init__(application=app,
                             title="nsfw-dl",
                             default_width=settings.get("window_width", 1100),
                             default_height=settings.get("window_height", 760))
            self.settings = settings
            self.executor: ThreadPoolExecutor | None = None
            self._rows: list[DownloadRow] = []
            self._batch_running = False

            self._build_header()
            self._build_body()

            # Apply settings to combos
            self.quality_combo.set_active(self._safe_idx(
                QUALITY_LABELS, settings.get("quality", "best")))
            self.cookies_combo.set_active(self._safe_idx(
                BROWSER_OPTIONS, settings.get("cookies_browser", "none")))

            self._setup_drop_target()

            if settings.get("auto_update_ytdlp", True):
                GLib.idle_add(self._bg_update)

            GLib.idle_add(self.entry.grab_focus)

        @staticmethod
        def _safe_idx(lst: list[str], val: str) -> int:
            try:
                return lst.index(val)
            except ValueError:
                return 0

        # ----- UI construction -----
        def _build_header(self):
            header = _make_header_bar()
            self.set_titlebar(header)

            btn_open = Gtk.Button.new_from_icon_name("folder-open-symbolic")
            btn_open.set_tooltip_text("Open output folder")
            btn_open.connect("clicked", self._open_output)
            header.pack_end(btn_open)

            btn_plugin = Gtk.Button.new_from_icon_name("application-x-addon-symbolic")
            btn_plugin.set_tooltip_text("Install MissAV / 91porn / Jable plugin")
            btn_plugin.connect("clicked", self._on_install_plugin_clicked)
            header.pack_end(btn_plugin)

            btn_update = Gtk.Button.new_from_icon_name(
                "software-update-available-symbolic")
            btn_update.set_tooltip_text("Update yt-dlp")
            btn_update.connect("clicked", self._on_update_clicked)
            header.pack_end(btn_update)

            btn_settings = Gtk.Button.new_from_icon_name(
                "preferences-system-symbolic")
            btn_settings.set_tooltip_text("Settings")
            btn_settings.connect("clicked", self._open_settings)
            header.pack_end(btn_settings)

        def _build_body(self):
            outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)

            scroller = Gtk.ScrolledWindow()
            scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

            content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
            content.set_margin_top(10)
            content.set_margin_bottom(10)
            content.set_margin_start(14)
            content.set_margin_end(14)
            clamp = _make_clamp(content)
            scroller.set_child(clamp)

            # --- URL input row ---
            row_url = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
            self.entry = Gtk.Entry()
            self.entry.set_placeholder_text("Paste video URL here... (Enter to download)")
            self.entry.set_hexpand(True)
            self.entry.connect("activate", self._on_add_pressed)
            row_url.append(self.entry)

            self.quality_combo = Gtk.ComboBoxText()
            for i, q in enumerate(QUALITY_LABELS):
                self.quality_combo.append(str(i), q)
            self.quality_combo.set_tooltip_text("Quality")
            self.quality_combo.connect("changed", self._on_quality_changed)
            row_url.append(self.quality_combo)

            self.cookies_combo = Gtk.ComboBoxText()
            for i, c in enumerate(BROWSER_OPTIONS):
                self.cookies_combo.append(str(i), c)
            self.cookies_combo.set_tooltip_text("Use cookies from browser")
            self.cookies_combo.connect("changed", self._on_cookies_changed)
            row_url.append(self.cookies_combo)

            self.btn_download = Gtk.Button(label="Download")
            self.btn_download.add_css_class("suggested-action")
            self.btn_download.add_css_class("pill")
            self.btn_download.connect("clicked", self._on_start_pressed)
            row_url.append(self.btn_download)

            content.append(row_url)

            # --- Site detection info ---
            self.site_info = Gtk.Label(label="", xalign=0)
            self.site_info.add_css_class("dim-label")
            self.site_info.add_css_class("caption")
            self.site_info.set_margin_start(2)
            content.append(self.site_info)

            self.entry.connect("changed", self._on_url_changed)

            # --- Queue list ---
            listbox = Gtk.ListBox()
            listbox.set_selection_mode(Gtk.SelectionMode.NONE)
            listbox.add_css_class("rich-list")
            self.listbox = listbox

            queue_frame = Gtk.Frame()
            queue_frame.set_child(listbox)
            queue_frame.set_vexpand(True)
            content.append(queue_frame)

            self.empty_state = _make_status_page(
                "Queue is empty",
                "Paste a video URL above and press Enter to download.",
                "folder-download-symbolic")
            listbox.set_placeholder(self.empty_state)

            # --- Log (collapsed) ---
            self.log_expander = Gtk.Expander(label="Log")
            self.log_expander.set_expanded(False)
            log_scroll = Gtk.ScrolledWindow()
            log_scroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
            log_scroll.set_min_content_height(120)
            self.log_view = Gtk.TextView()
            self.log_view.set_editable(False)
            self.log_view.set_monospace(True)
            self.log_view.set_top_margin(4)
            self.log_view.set_bottom_margin(4)
            self.log_view.set_left_margin(8)
            self.log_view.set_right_margin(8)
            self.log_view.set_wrap_mode(Gtk.WrapMode.WORD_CHAR)
            self.log_buffer = self.log_view.get_buffer()
            log_scroll.set_child(self.log_view)
            self.log_expander.set_child(log_scroll)
            content.append(self.log_expander)

            outer.append(scroller)
            outer.append(Gtk.Separator())

            # --- Footer / status bar ---
            footer = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
            footer.set_margin_start(10)
            footer.set_margin_end(10)
            footer.set_margin_bottom(4)
            footer.set_margin_top(2)
            self.status = Gtk.Label(label="Ready.")
            self.status.set_xalign(0)
            self.status.set_hexpand(True)
            self.status.add_css_class("dim-label")
            self.status.add_css_class("caption")
            footer.append(self.status)

            self._count_label = Gtk.Label(label="0 downloaded")
            self._count_label.set_xalign(1)
            self._count_label.add_css_class("dim-label")
            self._count_label.add_css_class("caption")
            footer.append(self._count_label)

            outer.append(footer)
            if HAS_ADW:
                self.set_content(outer)
            else:
                self.set_child(outer)

        def _setup_drop_target(self):
            try:
                drop = Gtk.DropTarget.new(
                    GObject.TYPE_STRING, Gtk.DragAction.COPY)
                drop.connect("drop", self._on_drop)
                self.add_controller(drop)
            except Exception:
                pass

        def _on_drop(self, _target, value, _x, _y):
            try:
                text = str(value) if value else ""
            except Exception:
                return False
            self._add_urls_from_text(text)
            return True

        def _add_urls_from_text(self, text: str) -> None:
            added = 0
            for line in text.splitlines():
                line = line.strip().strip('"').strip("'")
                if not line or line.startswith("#") or line.startswith("file://"):
                    continue
                while line and line[-1] in '.,;:!?':
                    line = line[:-1]
                if is_valid_url(line):
                    if any(r.url == line for r in self._rows):
                        continue
                    site = site_label(line)
                    row = DownloadRow(line, site, self)
                    self.listbox.append(row)
                    self._rows.append(row)
                    added += 1
            if added:
                self._set_status(f"Added {added} URL(s)")

        # ----- helpers -----
        def _log(self, line: str) -> None:
            ts = time.strftime("%H:%M:%S")
            GLib.idle_add(self._append_log, f"[{ts}] {line}\n")

        def _append_log(self, text: str) -> bool:
            try:
                end = self.log_buffer.get_end_iter()
                self.log_buffer.insert(end, text, -1)
                mark = self.log_buffer.create_mark(
                    None, self.log_buffer.get_end_iter(), False)
                self.log_view.scroll_to_mark(mark, 0.0, True, 0.0, 1.0)
            except Exception:
                pass
            return False

        def _set_status(self, txt: str) -> None:
            GLib.idle_add(self.status.set_text, txt)

        def _refresh_version_label(self) -> None:
            pass

        def _notify(self, title: str, body: str, action_id: str = "",
                    action_label: str = "") -> None:
            if not self.settings.get("notify_on_complete", True):
                return
            try:
                n = Gio.Notification.new(title)
                n.set_body(body)
                n.set_icon(Gio.ThemedIcon.new("object-select-symbolic"))
                if action_id and action_label:
                    n.add_button(action_label, action_id)
                app = self.props.application
                if app is not None:
                    app.send_notification("nsfw-dl", n)
            except Exception as exc:
                self._log(f"Notification failed: {exc}")

        # ----- handlers -----
        def _on_url_changed(self, entry):
            url = entry.get_text().strip()
            if not url:
                self.site_info.set_text("")
                self._set_status("Ready.")
                return
            label = site_label(url)
            cfg = detect_site(url)
            if cfg and cfg.needs_plugin and not plugin_installed(cfg.needs_plugin):
                self.site_info.set_text(
                    f"  {label}  —  requires plugin (install via Settings)")
            elif cfg and cfg.needs_cookies:
                self.site_info.set_text(
                    f"  {label}  —  login-gated: select browser in Cookies")
            elif cfg and cfg.impersonate:
                self.site_info.set_text(f"  {label}  —  impersonation active")
            elif cfg:
                self.site_info.set_text(f"  {label}  —  recognized")
            elif is_valid_url(url):
                self.site_info.set_text("  generic site")
            else:
                self.site_info.set_text("")
            if label:
                self._set_status(f"Detected: {label}")

        def _on_add_pressed(self, *_):
            url = self.entry.get_text().strip()
            if not url or not is_valid_url(url):
                return
            for r in self._rows:
                if r.url == url:
                    return
            site = site_label(url)
            row = DownloadRow(url, site, self)
            self.listbox.append(row)
            self._rows.append(row)
            self.entry.set_text("")
            self.site_info.set_text("")
            self._log(f"Added: {url}  ({site})")
            # Auto-start
            if not self._batch_running:
                self._on_start_pressed()

        def _on_quality_changed(self, combo):
            idx = combo.get_active()
            if 0 <= idx < len(QUALITY_LABELS):
                self.settings["quality"] = QUALITY_LABELS[idx]
                save_settings(self.settings)

        def _on_cookies_changed(self, combo):
            idx = combo.get_active()
            if 0 <= idx < len(BROWSER_OPTIONS):
                self.settings["cookies_browser"] = BROWSER_OPTIONS[idx]
                save_settings(self.settings)

        def _on_start_pressed(self, *_):
            if self._batch_running:
                return

            # If queue is empty, add URL from entry first
            if not self._rows:
                url = self.entry.get_text().strip()
                if url and is_valid_url(url):
                    site = site_label(url)
                    row = DownloadRow(url, site, self)
                    self.listbox.append(row)
                    self._rows.append(row)
                    self.entry.set_text("")
                    self.site_info.set_text("")
                    self._log(f"Added: {url}  ({site})")
                else:
                    return

            qidx = self.quality_combo.get_active()
            cidx = self.cookies_combo.get_active()
            self.settings["quality"] = (QUALITY_LABELS[qidx]
                                        if 0 <= qidx < len(QUALITY_LABELS)
                                        else "best")
            self.settings["cookies_browser"] = (BROWSER_OPTIONS[cidx]
                                                if 0 <= cidx < len(BROWSER_OPTIONS)
                                                else "none")
            save_settings(self.settings)

            queued = [r for r in self._rows if r.status == "Queued"]
            if not queued:
                return

            self._batch_running = True
            self.btn_download.set_sensitive(False)
            max_workers = max(1, int(self.settings.get("concurrent_downloads", 2)))
            self.executor = ThreadPoolExecutor(max_workers=max_workers)
            self._set_status(f"Downloading {len(queued)} item(s)...")
            self._log(f"Starting {len(queued)} download(s) "
                      f"with {max_workers} worker(s)")

            for r in queued:
                r.set_status("Running")

                def make_cb(row=r):
                    def cb(d: dict[str, Any]):
                        if d.get("status") == "downloading":
                            frac = 0.0
                            try:
                                frac = float(d.get("_percent_str", "0%")
                                             .rstrip("%")) / 100.0
                            except Exception:
                                frac = 0.0
                            spd = d.get("_speed_str", "").strip()
                            eta = d.get("_eta_str", "").strip()
                            row.update_progress(frac,
                                                f"{int(frac*100)}%  {spd}  ETA {eta}")
                        elif d.get("status") == "finished":
                            row.update_progress(1.0, "100%")
                            title = ""
                            if isinstance(d.get("info_dict"), dict):
                                title = d["info_dict"].get("title", "")
                            if not title:
                                title = d.get("filename", "") or row.url
                            row.set_title(title)
                    return cb

                def run_one(row=r):
                    try:
                        res = run_download(
                            row.url, self.settings,
                            on_progress=make_cb(row),
                            on_log=lambda m: self._log(m),
                            cancel_flag=row.cancel_event)
                        if res.ok:
                            row.set_status("Done")
                            if res.title:
                                row.set_title(res.title)
                            self._log(f"DONE: {res.filename or res.title or row.url}")
                            self._notify(
                                "Download complete",
                                res.title or row.url,
                                "app.open-output", "Open folder")
                        elif res.error == "cancelled":
                            row.set_status("Cancelled")
                        else:
                            row.set_status("Error")
                            self._log(f"ERROR ({row.url}): {res.error}")
                    except Exception as exc:
                        row.set_status("Error")
                        self._log(f"Worker crashed: {exc}")
                    GLib.idle_add(self._refresh_status)
                    GLib.idle_add(self._check_batch_done)

                r.future = self.executor.submit(run_one, r)

        def _check_batch_done(self):
            if not self._batch_running:
                return
            if any(r.status == "Running" for r in self._rows):
                return
            self._batch_running = False
            self.btn_download.set_sensitive(True)
            done = sum(1 for r in self._rows if r.status == "Done")
            err = sum(1 for r in self._rows if r.status == "Error")
            cancel = sum(1 for r in self._rows if r.status == "Cancelled")
            self._log(f"Batch finished: {done} ok, {err} error, {cancel} cancelled")
            self._notify("Batch finished",
                         f"{done} ok, {err} error, {cancel} cancelled",
                         "app.open-output", "Open folder")
            if self.settings.get("open_folder_on_complete", False):
                self._open_output()
            if self.executor is not None:
                try:
                    self.executor.shutdown(wait=False, cancel_futures=True)
                except Exception:
                    pass
                self.executor = None

        def _refresh_status(self):
            done = sum(1 for r in self._rows if r.status == "Done")
            total = len(self._rows)
            running = sum(1 for r in self._rows if r.status == "Running")
            if running > 0:
                self._set_status(f"Downloading... {done}/{total}")
            elif done > 0:
                self._set_status(f"Done {done}/{total}")
            else:
                self._set_status("Ready.")
            GLib.idle_add(self._count_label.set_text, f"{done} downloaded")

        def _remove_row(self, row):
            if row in self._rows:
                self._rows.remove(row)
            self.listbox.remove(row)

        def _open_output(self, *_):
            out = ensure_output_dir(self.settings.get(
                "output_dir", DEFAULT_SETTINGS["output_dir"]))
            if open_path(out):
                self._log(f"Opened output folder: {out}")

        def _open_settings(self, *_):
            dlg = SettingsDialog(self, self.settings)
            dlg.present()

        def _on_update_clicked(self, *_):
            if not hasattr(self, "_update_in_progress"):
                self._update_in_progress = False
            if self._update_in_progress:
                return
            self._update_in_progress = True
            self._log("Updating yt-dlp ...")
            threading.Thread(target=self._bg_update, daemon=True).start()

        def _bg_update(self):
            ok = update_ytdlp(quiet=True)
            self._log("yt-dlp updated." if ok else "yt-dlp update failed.")
            self._update_in_progress = False

        def _on_install_plugin_clicked(self, *_):
            if not hasattr(self, "_install_in_progress"):
                self._install_in_progress = False
            if self._install_in_progress or plugin_installed():
                return
            self._install_in_progress = True
            self._log(f"Installing {YT_DLP_PLUGIN_PKG} ...")
            threading.Thread(target=self._bg_install_plugin, daemon=True).start()

        def _bg_install_plugin(self):
            ok = install_plugin()
            self._log("Plugin installed." if ok else "Plugin install failed.")
            self._install_in_progress = False

        def do_close_request(self, *args):
            try:
                self.settings["window_width"] = self.get_width()
                self.settings["window_height"] = self.get_height()
                save_settings(self.settings)
            except Exception:
                pass
            if self.executor is not None:
                for r in self._rows:
                    r.cancel_event.set()
                try:
                    self.executor.shutdown(wait=False, cancel_futures=True)
                except Exception:
                    pass
            return False

    # ---- NsfwApp -----------------------------------------------------
    class NsfwApp(Gtk.Application if not HAS_ADW else Adw.Application):
        def __init__(self):
            super().__init__(application_id=APP_ID,
                             flags=Gio.ApplicationFlags.HANDLES_OPEN)
            self._build_actions()

        def _build_actions(self):
            self.create_action("quit", self._quit, ["<primary>q"])
            self.create_action("about", self._about, [])
            self.create_action("update", self._win_action("_on_update_clicked"), [])
            self.create_action("plugin", self._win_action("_on_install_plugin_clicked"), [])
            self.create_action("open-output", self._win_action("_open_output"), [])
            self.create_action("preferences",
                               self._win_action("_open_settings"),
                               ["<primary>comma"])
            self.create_action("focus-url", self._focus_url, ["<primary>n"])
            self.create_action("start-downloads",
                               self._win_action("_on_start_pressed"),
                               ["<primary>Return"])

        def create_action(self, name, callback, accels=None):
            action = Gio.SimpleAction.new(name, None)
            action.connect("activate", callback)
            self.add_action(action)
            if accels:
                self.set_accels_for_action(f"app.{name}", accels)

        def _win_action(self, method_name: str):
            def cb(_action, _params):
                w = self.props.active_window
                if w is not None:
                    getattr(w, method_name)()
            return cb

        def _focus_url(self, _action, _params):
            w = self.props.active_window
            if w is not None:
                w.entry.grab_focus()

        def _quit(self, _action, _params):
            self.quit()

        def _about(self, _action, _params):
            about = _make_about_dialog(self)
            about.present()

        def do_activate(self):
            win = self.props.active_window
            if not win:
                settings = load_settings()
                win = MainWindow(self, settings)
            win.present()

        def do_shutdown(self):
            win = self.props.active_window
            if win is not None and getattr(win, "executor", None):
                for r in getattr(win, "_rows", []):
                    r.cancel_event.set()
                try:
                    win.executor.shutdown(wait=False, cancel_futures=True)
                except Exception:
                    pass
            if HAS_ADW:
                Adw.Application.do_shutdown(self)
            else:
                Gtk.Application.do_shutdown(self)

    app = NsfwApp()

    # Force Wayland backend on Hyprland if not already set
    if os.environ.get("GDK_BACKEND") is None:
        if os.environ.get("XDG_SESSION_TYPE") == "wayland" or \
           os.environ.get("HYPRLAND_INSTANCE_SIGNATURE"):
            os.environ["GDK_BACKEND"] = "wayland"

    try:
        rc = app.run([sys.argv[0]])
        return rc
    except KeyboardInterrupt:
        return 130


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="nsfw-dl",
        description="Video downloader with GUI + CLI. Optimized for Arch + Hyprland.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  nsfw-dl                                   # launch GUI
  nsfw-dl --gui                             # force GUI
  nsfw-dl "https://www.pornhub.com/view/.." # CLI download
  nsfw-dl URL -q 1080 -o ~/Videos           # 1080p to ~/Videos
  nsfw-dl URL -c firefox                    # use Firefox cookies
  nsfw-dl --update                          # update yt-dlp
  nsfw-dl --install-plugin                  # install MissAV/91porn/Jable plugin
  nsfw-dl --list-sites                      # show known sites
  nsfw-dl --check URL                       # test if URL is supported""")
    p.add_argument("url", nargs="?", help="URL(s) to download (comma-separated)")
    p.add_argument("--gui", action="store_true",
                   help="Force GUI mode even when URL is given")
    p.add_argument("--update", action="store_true",
                   help="Update yt-dlp via 'yt-dlp -U'")
    p.add_argument("--install-plugin", action="store_true",
                   help=f"Install {YT_DLP_PLUGIN_PKG} pip package")
    p.add_argument("--list-sites", action="store_true",
                   help="List known sites & site-specific tweaks")
    p.add_argument("--check", metavar="URL", help="Check if a URL is supported")
    p.add_argument("--version", action="store_true",
                   help="Show nsfw-dl and yt-dlp versions")
    p.add_argument("-o", "--output", help="Output folder (CLI)")
    p.add_argument("-q", "--quality", choices=QUALITY_LABELS,
                   help="Quality preset (CLI)")
    p.add_argument("-c", "--cookies", choices=BROWSER_OPTIONS,
                   help="Use cookies from this browser (CLI)")
    p.add_argument("--embed-meta", action="store_true",
                   help="Embed metadata (CLI override)")
    p.add_argument("--no-meta", action="store_true", help="Disable metadata")
    p.add_argument("--embed-thumb", action="store_true",
                   help="Embed thumbnail (CLI override)")
    p.add_argument("--no-thumb", action="store_true", help="Disable thumbnail")
    p.add_argument("--no-archive", action="store_true",
                   help="Disable download archive")
    p.add_argument("-v", "--verbose", action="store_true",
                   help="Verbose yt-dlp logging")
    return p


def main() -> int:
    args = build_parser().parse_args()

    if args.version:
        print(f"nsfw-dl {APP_VERSION}")
        print(f"yt-dlp: {ytdlp_version() or '(not found)'}")
        print(f"MissAV plugin: {'installed' if plugin_installed() else 'not installed'}")
        print(f"Config: {CONFIG_FILE}")
        return 0

    if args.update:
        return 0 if update_ytdlp(quiet=False) else 1

    if args.install_plugin:
        return 0 if install_plugin() else 1

    if args.list_sites:
        cli_list_sites()
        return 0

    if args.check:
        return cli_check_url(args.check)

    # GUI mode
    if args.gui:
        return gui_main()

    # No URL: GUI if interactive, error otherwise
    if not args.url:
        if sys.stdout.isatty():
            return gui_main()
        _err("No URL given. Use --help for usage.")
        return 2

    # CLI mode
    return cli_main(args)


if __name__ == "__main__":
    sys.exit(main())
