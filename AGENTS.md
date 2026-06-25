# X-Downloader 2.0 — AGENTS.md

## Project Overview

Full-stack video downloader with WebSocket real-time progress, 3D interactive UI, and Tauri desktop wrapper.

**Repository:** `github.com/Niumination/x-downloader`
**Stack:** FastAPI + Next.js 16 (React 19) + Three.js + Tauri 2
**Legacy:** Original GTK4/CLI script lives in `nsfw-dl/` (v1.1.0)

## Directory Structure

```
x-downloader/
├── backend/
│   ├── main.py              # FastAPI server + yt-dlp engine
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx          # Main UI (landing + queue)
│   │   ├── layout.tsx        # Root layout + metadata
│   │   └── globals.css       # Tailwind v4 + custom styles
│   ├── components/
│   │   ├── DownloadOrb.tsx    # 3D download sphere (R3F)
│   │   ├── QueueItem.tsx      # Download queue card
│   │   ├── SettingsDialog.tsx  # Modal settings
│   │   ├── FormatPreview.tsx   # yt-dlp -F viewer
│   │   └── BatchImport.tsx    # Multi-URL batch dialog
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── postcss.config.mjs
├── tauri-app/                 # Desktop wrapper (Tauri 2)
│   ├── package.json
│   └── src-tauri/tauri.conf.json
├── docs/
│   └── UI_VISUAL_EXAMPLES.md  # UI/UX style reference
├── original/
│   └── original-nsfw-dl.py    # Original monolithic script (backup)
├── start.sh                   # Full-stack launcher
├── nsfw-dl/                   # Legacy v1.1.0 (GTK4/CLI)
├── CLAUDE.md
└── AGENTS.md
```

## How to Run

### Full Stack (recommended)
```bash
./start.sh
```
Opens UI at `http://localhost:3000`, API at `http://localhost:8000/docs`.

### Backend only
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend only
```bash
cd frontend
npm install
npm run dev
```

## Architecture

### Backend (`backend/main.py`)
| Component | Description |
|-----------|-------------|
| **FastAPI app** | `GET /api/downloads`, `POST /api/download`, `POST /api/cancel/{id}`, `GET /api/settings`, `POST /api/settings`, `GET /api/preview-formats`, `POST /api/batch-download`, `GET /api/history` |
| **WebSocket** | `/ws` — real-time progress broadcasts |
| **DownloadManager** | Thread pool (6 workers), yt-dlp integration, progress hooks |
| **SQLite** | Download history via SQLAlchemy |
| **Site configs** | PornHub, MissAV, 91Porn, OnlyFans + generic |

### Frontend (`frontend/`)
| Component | Tech | Purpose |
|-----------|------|---------|
| `page.tsx` | React 19 + Framer Motion | Main UI: hero, URL input, queue list, stats |
| `DownloadOrb.tsx` | React Three Fiber + drei | 3D interactive sphere with progress ring |
| `QueueItem.tsx` | Framer Motion | Animated download card with progress bar |
| `SettingsDialog.tsx` | Framer Motion | Modal settings for output dir, metadata, cookies |
| `FormatPreview.tsx` | Fetch API | Modal showing `yt-dlp -F` output |
| `BatchImport.tsx` | React state | Multi-line URL input with batch start |

### Desktop (`tauri-app/`)
Tauri 2 scaffolding. `beforeDevCommand` runs frontend dev server automatically.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/downloads` | All active downloads |
| POST | `/api/download` | Start download (body: `{url, quality?, cookies_browser?}`) |
| POST | `/api/cancel/{id}` | Cancel download |
| GET | `/api/settings` | Current settings |
| POST | `/api/settings` | Update settings |
| GET | `/api/preview-formats?url=` | List available formats |
| POST | `/api/batch-download` | Start batch (body: `{urls[], quality?, cookies_browser?}`) |
| GET | `/api/history?limit=30` | Download history from DB |
| WS | `/ws` | Real-time progress |

## Dependencies

**Backend:** `pip install -r backend/requirements.txt`
- fastapi, uvicorn, pydantic, sqlalchemy, yt-dlp, websockets, aiofiles

**Frontend:** `npm install` in `frontend/`
- next, react 19, three, @react-three/fiber + drei, framer-motion, lucide-react, sonner, tailwindcss v4, radix-ui

**Desktop:** `npm install` in `tauri-app/` then `npm run tauri dev`
- @tauri-apps/cli

## Legacy App

Original v1.1.0 (GTK4/libadwaita + CLI) remains at `nsfw-dl/` for reference.
The backup is at `original/original-nsfw-dl.py`.

## Conventions

- **Backend bug**: `s.dict()` in Pydantic v2 should be `s.model_dump()` — already fixed in `backend/main.py`
- **Language**: Respond in Indonesian (Bahasa Indonesia)
- **Bump version**: update version in `frontend/package.json`, `backend/main.py` (FASTAPI title), and `tauri-app/src-tauri/tauri.conf.json`
- **All communication**: via REST + WebSocket, no direct filesystem access from frontend
- **Frontend uses**: `"use client"` directive (Next.js App Router client components)
