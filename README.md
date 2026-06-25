# X-Downloader 2.0

> Modern full-stack video downloader — FastAPI backend + Next.js 16 frontend + Tauri 2 desktop wrapper.

![3D Download Orb](docs/orb-preview.gif)

**v1.1.0 legacy** (GTK4/CLI) is still available in `nsfw-dl/`.

---

## ✨ Features

- **1500+ supported sites** — PornHub, MissAV, 91Porn, OnlyFans, Twitter/X, Reddit, etc.
- **Real-time progress** via WebSocket — live speed, ETA, percentage
- **3D Interactive Download Orb** — React Three Fiber + Framer Motion
- **Glassmorphism UI** — dark theme with smooth animations
- **Batch download** — import multiple URLs at once
- **Format preview** — browse `yt-dlp -F` output before downloading
- **Browser cookies** — import from Chrome, Firefox, Brave, Edge
- **Download history** — SQLite-backed persistent history
- **Desktop app** — Tauri 2 wrapper (cross-platform)

## 🚀 Quick Start

```bash
# Full stack
./start.sh

# Open at http://localhost:3000
```

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

## 🔧 API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/downloads` | GET | Active downloads |
| `/api/download` | POST | Start download |
| `/api/cancel/{id}` | POST | Cancel download |
| `/api/settings` | GET/POST | Settings |
| `/api/preview-formats?url=` | GET | List formats |
| `/api/batch-download` | POST | Batch start |
| `/api/history?limit=30` | GET | History |
| `/ws` | WS | Real-time progress |

Full API docs at `http://localhost:8000/docs`.

## 🏗️ Architecture

```
x-downloader/
├── backend/
│   └── main.py          # FastAPI + yt-dlp engine
├── frontend/
│   ├── app/              # Next.js pages
│   ├── components/       # React components + 3D orb
│   └── package.json
├── tauri-app/            # Desktop wrapper
├── nsfw-dl/              # Legacy v1.1.0
└── start.sh
```

## 📦 Tech Stack

- **Backend**: Python (FastAPI, yt-dlp, SQLAlchemy, SQLite)
- **Frontend**: TypeScript (Next.js 16, React 19, Three.js, Framer Motion)
- **Desktop**: Rust (Tauri 2)
- **Real-time**: WebSocket

## 📝 License

MIT
