#!/usr/bin/env python3
"""
X-Downloader 2.0 Backend - Complete Version
"""
from __future__ import annotations
import asyncio
import json
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import yt_dlp

APP_NAME = "x-downloader"
CONFIG_DIR = Path.home() / ".config" / APP_NAME
CONFIG_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = CONFIG_DIR / "downloads.db"
CONFIG_FILE = CONFIG_DIR / "config.json"

FORMAT_PRESETS = {
    "best": "bestvideo*+bestaudio/best",
    "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
    "720p": "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
    "audio": "bestaudio/best",
}

KNOWN_SITES = {
    "pornhub.com": {"name": "PornHub", "referer": "https://www.pornhub.com/", "impersonate": True},
    "missav.com": {"name": "MissAV", "impersonate": True},
    "91porn.com": {"name": "91Porn"},
    "onlyfans.com": {"name": "OnlyFans", "needs_cookies": True},
}

Base = declarative_base()

class Download(Base):
    __tablename__ = "downloads"
    id = Column(Integer, primary_key=True)
    url = Column(String)
    title = Column(String, default="")
    site = Column(String, default="")
    quality = Column(String, default="best")
    status = Column(String, default="pending")
    progress = Column(Float, default=0.0)
    speed = Column(String, default="")
    eta = Column(String, default="")
    filename = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    error = Column(String, default="")

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

class DownloadRequest(BaseModel):
    url: str
    quality: str = "best"
    cookies_browser: str = "none"
    output_dir: Optional[str] = None

class BatchDownloadRequest(BaseModel):
    urls: list[str]
    quality: str = "best"
    cookies_browser: str = "none"

class SettingsUpdate(BaseModel):
    output_dir: Optional[str] = None
    embed_metadata: Optional[bool] = None
    embed_thumbnail: Optional[bool] = None

@dataclass
class DownloadTask:
    id: int
    url: str
    quality: str
    cookies_browser: str
    output_dir: str
    progress: float = 0.0
    status: str = "pending"
    speed: str = ""
    eta: str = ""
    title: str = ""
    filename: str = ""
    site: str = ""
    error: str = ""

class DownloadManager:
    def __init__(self):
        self.tasks = {}
        self.executor = ThreadPoolExecutor(max_workers=6)
        self.ws_clients = []
        self.config = {
            "output_dir": str(Path.home() / "Videos" / "x-downloader"),
            "embed_metadata": True,
            "embed_thumbnail": True,
        }

    async def broadcast(self, data):
        disconnected = []
        for ws in self.ws_clients:
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            if ws in self.ws_clients:
                self.ws_clients.remove(ws)

    def get_site_config(self, url):
        domain = urlparse(url).netloc.lower()
        for k, v in KNOWN_SITES.items():
            if k in domain:
                return v
        return {"name": "Generic"}

    def _get_opts(self, task):
        site = self.get_site_config(task.url)
        opts = {
            "format": FORMAT_PRESETS.get(task.quality, "best"),
            "outtmpl": os.path.join(task.output_dir, "%(title)s [%(id)s].%(ext)s"),
            "progress_hooks": [self._hook(task)],
            "quiet": True,
            "merge_output_format": "mp4",
        }
        if task.cookies_browser != "none":
            opts["cookiesfrombrowser"] = (task.cookies_browser,)
        if site.get("referer"):
            opts["http_headers"] = {"Referer": site["referer"]}
        if site.get("impersonate"):
            opts["impersonate"] = "chrome"
        return opts

    def _hook(self, task):
        def hook(d):
            if d["status"] == "downloading":
                try:
                    task.progress = float(d.get("_percent_str", "0%").replace("%", "").strip())
                except Exception:
                    task.progress = 0
                task.speed = d.get("_speed_str", "")
                task.eta = d.get("_eta_str", "")
                task.status = "downloading"
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(self.broadcast_status(task))
                except Exception:
                    pass
            elif d["status"] == "finished":
                task.status = "completed"
                task.progress = 100
                task.filename = os.path.basename(d.get("filename", ""))
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(self.broadcast_status(task))
                except Exception:
                    pass
        return hook

    async def broadcast_status(self, task):
        await self.broadcast({
            "type": "progress", "id": task.id, "progress": task.progress,
            "speed": task.speed, "eta": task.eta, "status": task.status,
            "title": task.title, "filename": task.filename
        })

    def download_task(self, task):
        try:
            task.status = "downloading"
            opts = self._get_opts(task)
            with yt_dlp.YoutubeDL({**opts, "simulate": True}) as ydl:
                info = ydl.extract_info(task.url, download=False)
                if info:
                    task.title = info.get("title", "Unknown")
                    task.site = self.get_site_config(task.url)["name"]
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([task.url])
            if task.status != "completed":
                task.status = "completed"
                task.progress = 100
        except Exception as e:
            task.status = "error"
            task.error = str(e)[:180]
        finally:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self.broadcast_status(task))
            except Exception:
                pass

    async def add(self, req: DownloadRequest):
        out_dir = req.output_dir or self.config["output_dir"]
        os.makedirs(out_dir, exist_ok=True)
        tid = int(time.time() * 1000)
        task = DownloadTask(tid, req.url, req.quality, req.cookies_browser, out_dir)
        self.tasks[tid] = task
        db = SessionLocal()
        db.add(Download(id=tid, url=req.url, quality=req.quality, site=self.get_site_config(req.url)["name"]))
        db.commit()
        db.close()
        self.executor.submit(self.download_task, task)
        await self.broadcast({"type": "new_download", "id": tid})
        return tid

    def cancel(self, tid):
        if tid in self.tasks:
            self.tasks[tid].status = "cancelled"

    def get_all(self):
        return list(self.tasks.values())

download_manager = DownloadManager()

app = FastAPI(title="X-Downloader 2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.websocket("/ws")
async def ws(ws: WebSocket):
    await ws.accept()
    download_manager.ws_clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except Exception:
        if ws in download_manager.ws_clients:
            download_manager.ws_clients.remove(ws)

@app.get("/api/downloads")
async def downloads():
    return [asdict(t) for t in download_manager.get_all()]

@app.post("/api/download")
async def start(req: DownloadRequest):
    return {"id": await download_manager.add(req)}

@app.post("/api/cancel/{tid}")
async def cancel(tid: int):
    download_manager.cancel(tid)
    return {"ok": True}

@app.get("/api/settings")
async def settings():
    return download_manager.config

@app.post("/api/settings")
async def update_settings(s: SettingsUpdate):
    for k, v in s.model_dump(exclude_unset=True).items():
        download_manager.config[k] = v
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(download_manager.config, f, indent=2)
    except Exception:
        pass
    return {"ok": True}

@app.get("/api/preview-formats")
async def preview(url: str):
    try:
        r = subprocess.run(["yt-dlp", "-F", url], capture_output=True, text=True, timeout=25)
        return {"success": True, "formats": r.stdout}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/batch-download")
async def batch(req: BatchDownloadRequest):
    res = []
    for u in req.urls:
        try:
            tid = await download_manager.add(DownloadRequest(url=u, quality=req.quality, cookies_browser=req.cookies_browser))
            res.append({"url": u, "id": tid})
        except Exception as e:
            res.append({"url": u, "error": str(e)})
    return {"results": res}

@app.get("/api/history")
async def hist(limit: int = 30):
    db = SessionLocal()
    rows = db.query(Download).order_by(Download.created_at.desc()).limit(limit).all()
    db.close()
    return [asdict(r) for r in rows]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
