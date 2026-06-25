# nsfw-dl

GTK4 / libadwaita video downloader for **Arch Linux + Hyprland**, powered by
[yt-dlp](https://github.com/yt-dlp/yt-dlp).

Native Wayland first-class, looks great in Hyprland, and ships with a CLI for
your terminal workflow.

![icon](assets/icon.svg)

## Features

### GUI (GTK4 + libadwaita, native Wayland)
- **Clean modern UI** with libadwaita widgets — matches any Hyprland rice.
- **Site auto-detection** with live badge ("PornHub / MissAV / Generic …").
- **Quality presets**: best / 2160p / 1080p / 720p / 480p / 360p / audio.
- **Browser cookies** — Chrome, Chromium, Firefox, Brave, Edge, Opera,
  Vivaldi, Safari.
- **Concurrent downloads** (1–8) with live progress, speed, ETA per row.
- **Download queue** with cancel / remove per item.
- **Format preview** button — runs `yt-dlp -F` to show available formats.
- **System notifications** when downloads complete (Gio.Notification).
- **Drag & drop URLs** from browser / file manager / text.
- **Persistent settings** in `~/.config/nsfw-dl/config.json`.
- **Settings dialog** (Adw.PreferencesWindow) with 14+ options.
- **Header buttons**: ⚙ Settings • ↻ Update yt-dlp • + Plugin • 📂 Open folder.
- **Keyboard shortcuts**:
  - `Ctrl+N` — focus URL input
  - `Ctrl+Enter` — start downloads
  - `Ctrl+,` — open settings
  - `Ctrl+Q` — quit

### CLI (terminal workflow)
- `nsfw-dl URL` — download with defaults
- `nsfw-dl URL1,URL2,URL3` — batch (parallel)
- `nsfw-dl URL -q 1080 -o ~/Videos` — 1080p to custom dir
- `nsfw-dl URL -c firefox` — use Firefox cookies
- `nsfw-dl --check URL` — test if URL is supported + show title/duration
- `nsfw-dl --update` — update yt-dlp
- `nsfw-dl --install-plugin` — install MissAV / 91porn / Jable.tv plugin
- `nsfw-dl --list-sites` — show all known sites + tweaks

### Backend
- **yt-dlp** — supports 1500+ sites.
- **Auto-applies site workarounds**:
  - Pornhub → `--referer https://www.pornhub.com/` + `--impersonate chrome`
  - MissAV / 91porn / Jable.tv → `yt-dlp-plugin-yellow` (auto-installable)
  - xHamster, XNXX, Brazzers → `--impersonate chrome`
  - OnlyFans, Fansly, Twitter/X, Reddit → browser cookies recommended
  - XVideos, YouPorn, RedTube, SpankBang → native support
- **Embeds metadata + thumbnail** into output container.
- **Download archive** — won't re-download what's already there.

## Supported sites

Run `nsfw-dl --list-sites` for the full list. Highlights:

| Site        | Tweaks applied                                   |
|-------------|--------------------------------------------------|
| Pornhub     | `--referer` + `--impersonate chrome`              |
| MissAV      | `--impersonate` + `yt-dlp-plugin-yellow`         |
| 91porn      | `yt-dlp-plugin-yellow`                           |
| Jable.tv    | `yt-dlp-plugin-yellow`                           |
| xHamster    | `--impersonate chrome`                           |
| XNXX        | `--impersonate chrome`                           |
| XVideos     | (works natively)                                  |
| YouPorn     | (works natively)                                  |
| RedTube     | (works natively)                                  |
| SpankBang   | (works natively)                                  |
| OnlyFans    | requires browser cookies                         |
| Fansly      | requires browser cookies                         |
| Twitter/X   | requires browser cookies                         |
| Reddit      | requires browser cookies                         |
| Hanime.tv   | (works natively)                                  |

…and 1500+ more via yt-dlp's standard extractors.

## Installation

### Option A — One-shot installer (recommended)

```bash
cd nsfw-dl
chmod +x install.sh uninstall.sh
./install.sh --plugin         # installs everything + MissAV plugin
```

Flags:
- `--user` — install into `~/.local`, no sudo.
- `--plugin` — also install `yt-dlp-plugin-yellow` (MissAV / 91porn / Jable.tv).
- `--no-deps` — skip the pacman step (if you already have deps).
- `--force` — overwrite existing files unconditionally.

To remove: `sudo ./uninstall.sh` (or `./uninstall.sh --user`).

### Option B — AUR / makepkg

```bash
cd nsfw-dl
makepkg -si
```

### Option C — Run from source

```bash
./nsfw-dl                  # launches GUI directly
```

### Dependencies (Arch package names)

```
python python-gobject gtk4 libadwaita yt-dlp ffmpeg desktop-file-utils
```

Optional:
```
python-pip                  # for yt-dlp-plugin-yellow (MissAV/91porn/Jable.tv)
```

## Usage

### GUI

Run `nsfw-dl` (or click the app icon in your Hyprland launcher).

1. Paste a URL → press **Enter** (or click **Add**).
2. Adjust quality / cookies if needed.
3. Click **Start downloads** (or `Ctrl+Enter`).
4. Optional: click **Preview** to see available formats first.
5. Optional: drag & drop a URL from your browser into the window.

The GUI auto-detects the site and shows it next to the URL field.
If a site needs the MissAV plugin and it's not installed, you'll see a
warning + the plugin install button (header + icon) will fix it.

### CLI

```bash
nsfw-dl "https://www.pornhub.com/view/video123"            # best quality
nsfw-dl "URL" -q 1080 -o ~/Videos                          # 1080p, custom dir
nsfw-dl "URL" -c firefox                                    # use Firefox cookies
nsfw-dl "URL1,URL2,URL3"                                    # batch (parallel)
nsfw-dl --check "URL"                                       # verify URL works
nsfw-dl --update                                            # update yt-dlp
nsfw-dl --install-plugin                                    # install MissAV plugin
nsfw-dl --list-sites                                        # show site tweaks
nsfw-dl --version                                           # versions
```

Settings persist between CLI & GUI runs (both use the same JSON config).

## Configuration

Stored at `~/.config/nsfw-dl/config.json`. Edit by hand or via the GUI
settings dialog. Keys:

```json
{
  "output_dir": "~/Videos/nsfw-dl",
  "quality": "best",
  "cookies_browser": "none",
  "embed_metadata": true,
  "embed_thumbnail": true,
  "embed_subtitles": false,
  "concurrent_downloads": 2,
  "auto_update_ytdlp": true,
  "use_impersonate": true,
  "filename_template": "%(title)s [%(id)s].%(ext)s",
  "restrict_filenames": true,
  "download_archive": true,
  "verbose_logging": false,
  "notify_on_complete": true,
  "open_folder_on_complete": false,
  "window_width": 1100,
  "window_height": 760
}
```

## Troubleshooting

| Symptom                                          | Fix                                                         |
|--------------------------------------------------|-------------------------------------------------------------|
| GUI won't open / `gi.require_version` fails      | `sudo pacman -S python-gobject gtk4 libadwaita`             |
| `ImportError: No module named 'gi'`              | Same as above (you're missing PyGObject)                    |
| Pornhub returns `410 Gone` / 404                | Update yt-dlp: `nsfw-dl --update`                           |
| MissAV / 91porn / Jable says "Unsupported URL"   | Install plugin: `nsfw-dl --install-plugin`                  |
| Download stuck on "fetching video info"          | Try browser cookies: select your browser in **Settings**    |
| Login-gated content (OnlyFans, Fansly)           | Use cookies from a logged-in browser                        |
| `ImportError: ffmpeg` or audio merge fails       | `sudo pacman -S ffmpeg`                                     |
| App icon doesn't appear in launcher              | `gtk-update-icon-cache -f /usr/share/icons/hicolor`         |
| Hyprland rendering glitches                      | Force Wayland backend: `GDK_BACKEND=wayland nsfw-dl`        |
| Notification not showing                         | Check `Settings → Notifications → Notify on completion`     |
| Drag & drop not working                          | Make sure you drop on the main window or URL field          |

## License

MIT — see `LICENSE`.

## Credits

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — the actual downloader.
- [yt-dlp-plugin-yellow](https://github.com/wmrussell8653/yt-dlp-plugin-yellow)
  — MissAV / 91porn / Jable.tv plugin.
- [PyGObject](https://pygobject.gnome.org/), [GTK4](https://gtk.org/),
  [libadwaita](https://gnome.pages.gitlab.gnome.org/libadwaita/) — the GUI.
