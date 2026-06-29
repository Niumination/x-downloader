# x-downloader — Tauri Desktop App

## Arsitektur
- **Frontend:** Vite 5 + React 18 + TypeScript + Three.js (3D orb) + framer-motion
- **Backend:** Rust/Tauri 2 — spawn yt-dlp via tokio subprocess
- **Build:** Tauri 2 (desktop app, macOS native)

## Commands
```bash
npm install           # Install frontend deps
npm run dev           # Vite dev server (browser)
RUSTUP_HOME=/Users/zaryu/.rustup CARGO_HOME=/Users/zaryu/.cargo npm run tauri dev     # Tauri dev window
RUSTUP_HOME=/Users/zaryu/.rustup CARGO_HOME=/Users/zaryu/.cargo npm run tauri build   # Build .app binary
```

## Rust envar workaround
Toolchain HermesAgent USB corrupt — selalu set `RUSTUP_HOME=/Users/zaryu/.rustup CARGO_HOME=/Users/zaryu/.cargo` untuk cargo/rustup/tauri command.

## Struktur
```
x-downloader/
├── index.html              # Vite entry
├── package.json            # Node deps
├── vite.config.ts          # Vite + Tauri config
├── tsconfig.json           # TypeScript
├── src/
│   ├── main.tsx            # React entry
│   ├── App.tsx             # Main component
│   ├── index.css           # Styles
│   └── components/
│       ├── DownloadOrb.tsx   # Download button + status
│       ├── SettingsModal.tsx  # Output dir settings
│       ├── BatchImport.tsx    # Batch import modal (paste multiple URLs)
│       └── FormatPreview.tsx  # yt-dlp -F format preview
└── src-tauri/
    ├── Cargo.toml          # Rust deps
    ├── tauri.conf.json     # Tauri config
    ├── capabilities/default.json  # Tauri 2 permissions (dialog)
    ├── build.rs            # Tauri build script
    ├── icons/              # App icons
    └── src/
        └── main.rs         # Rust backend (yt-dlp bridge)
```

## Backend (Rust) — Commands
- `start_download(url, quality, cookies_browser, output_dir)` → spawn yt-dlp subprocess, emit `download-update` events via Tauri event system
  - Progress di-realtime emit via `app.emit("download-update", DownloadItem)`
  - Frontend listens via `listen('download-update', callback)` from `@tauri-apps/api/event`
- `cancel_download(id)` → sends signal via tokio watch channel, spawned task kills yt-dlp (SIGKILL) + cleans up store
- `preview_formats(url)` → runs `yt-dlp -F <url>`, returns stdout as string for format selection UI

### Cancel architecture
- Uses `tokio::sync::watch` channel — `kill_tx` stored in `ActiveDownload` struct
- `run_download` uses `tokio::select! { biased; kill_rx.changed() => ..., lines.next_line() => ... }`
- When kill signal received, `child.kill().await` (SIGKILL on Unix), then cleanup

## Frontend Features
- React 18 + TypeScript
- Inline CSS (no Tailwind/PostCSS)
- Tauri invoke API + event listeners for real-time progress
- **Components:**
  - `App` (main layout) — URL input, quality/cookies/folder selectors, download queue with progress bars
  - `DownloadOrb` — 3D Three.js sphere visualizing download state
  - `SettingsModal` — default output folder picker via `@tauri-apps/plugin-dialog`
  - `BatchImport` — modal with textarea for pasting multiple URLs, downloaded sequentially
  - `FormatPreview` — modal showing `yt-dlp -F` output for the entered URL (fetched via `invoke('preview_formats')`)

## Important
- Requires `yt-dlp` CLI installed system-wide
- Rust toolchain required for Tauri build (use user's at `/Users/zaryu/.rustup/`)
- Node 20+ for frontend dev
- Tauri 2 plugin system: `tauri-plugin-dialog` registered via `Cargo.toml` + `capabilities/default.json`
