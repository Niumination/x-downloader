"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, Settings, Play, Pause, Trash2, RefreshCw, 
  FolderOpen, Plus, AlertCircle, CheckCircle 
} from 'lucide-react';
import { toast } from 'sonner';

import DownloadOrb from '../components/DownloadOrb';
import QueueItem from '../components/QueueItem';
import SettingsDialog from '../components/SettingsDialog';
import FormatPreview from '../components/FormatPreview';
import BatchImport from '../components/BatchImport';

interface DownloadItem {
  id: number;
  url: string;
  title: string;
  site: string;
  quality: string;
  status: string;
  progress: number;
  speed: string;
  eta: string;
  filename: string;
  error: string;
}

export default function XDownloader() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('best');
  const [cookiesBrowser, setCookiesBrowser] = useState('none');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showFormatPreview, setShowFormatPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showBatch, setShowBatch] = useState(false);
  const [settings, setSettings] = useState({
    output_dir: '~/Videos/x-downloader',
    concurrent_downloads: 3,
    embed_metadata: true,
    embed_thumbnail: true,
  });

  // WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'progress') {
        setDownloads(prev => prev.map(d => 
          d.id === data.id 
            ? { ...d, progress: data.progress, speed: data.speed, eta: data.eta, status: data.status, title: data.title || d.title, filename: data.filename || d.filename }
            : d
        ));
      } else if (data.type === 'new_download') {
        // Will be handled by polling
      }
    };

    ws.onopen = () => console.log('WebSocket connected');
    ws.onerror = () => console.log('WebSocket error');

    return () => ws.close();
  }, []);

  // Poll downloads
  useEffect(() => {
    const interval = setInterval(fetchDownloads, 1200);
    fetchDownloads();
    fetchSettings();
    return () => clearInterval(interval);
  }, []);

  const fetchDownloads = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/downloads');
      const data = await res.json();
      setDownloads(data);
    } catch (err) {
      // Silently fail if backend not running
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch {}
  };

  const handleAddDownload = async () => {
    if (!url.trim()) {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          quality,
          cookies_browser: cookiesBrowser,
        }),
      });

      if (res.ok) {
        const { id } = await res.json();
        toast.success(`Download #${id} started`, {
          description: url.substring(0, 60) + '...',
        });
        
        // Optimistic UI
        const newDownload: DownloadItem = {
          id,
          url: url.trim(),
          title: 'Fetching info...',
          site: 'Detecting...',
          quality,
          status: 'pending',
          progress: 0,
          speed: '',
          eta: '',
          filename: '',
          error: '',
        };
        setDownloads(prev => [newDownload, ...prev]);
        setUrl('');
      } else {
        toast.error("Failed to start download");
      }
    } catch (error) {
      toast.error("Backend not reachable. Make sure the server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const cancelDownload = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/cancel/${id}`, { method: 'POST' });
      setDownloads(prev => prev.map(d => 
        d.id === id ? { ...d, status: 'cancelled' } : d
      ));
      toast.info("Download cancelled");
    } catch {}
  };

  const removeDownload = (id: number) => {
    setDownloads(prev => prev.filter(d => d.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddDownload();
    }
  };

  const openSettings = () => setIsSettingsOpen(true);

  const updateSettings = async (newSettings: any) => {
    try {
      await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      setSettings(newSettings);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  // Batch handler
  const handleBatchDownload = async (urls: string[], quality: string, cookiesBrowser: string) => {
    try {
      const res = await fetch('http://localhost:8000/api/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, quality, cookies_browser: cookiesBrowser }),
      });
      const data = await res.json();
      toast.success(`${data.results.length} downloads started`);
      fetchDownloads();
    } catch {
      toast.error("Batch download failed");
    }
  };

  // Preview formats
  const openFormatPreview = (url: string) => {
    setPreviewUrl(url);
    setShowFormatPreview(true);
  };

  const activeDownloads = downloads.filter(d => ['pending', 'downloading'].includes(d.status));
  const completedDownloads = downloads.filter(d => d.status === 'completed');

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top Navigation */}
      <nav className="border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold tracking-tight text-xl">X-Downloader</div>
                <div className="text-[10px] text-zinc-500 -mt-1">v2.0 • Modern Edition</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={openSettings}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-white/10 hover:bg-white/5 transition-all active:scale-[0.985]"
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button 
              onClick={() => window.open('http://localhost:8000/docs', '_blank')}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-white/10 hover:bg-white/5"
            >
              API Docs
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-8 pb-16">
        {/* Hero Section with 3D Orb */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 mb-14">
          <div className="flex-1 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-xs font-medium tracking-widest mb-4 border border-white/10">
              POWERED BY YT-DLP • 1500+ SITES
            </div>
            
            <h1 className="text-7xl font-semibold tracking-tighter leading-none mb-4">
              Download.<br />Beautifully.
            </h1>
            <p className="text-xl text-zinc-400 max-w-md">
              Fast, private, and stunningly designed video downloader with real-time 3D animations.
            </p>

            <div className="flex gap-4 mt-8 flex-wrap">
              <button 
                onClick={() => document.getElementById('input-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-3 px-8 py-3.5 bg-white text-black rounded-2xl font-medium hover:bg-white/90 active:bg-white/80 transition-all"
              >
                <Plus className="w-4 h-4" /> Start New Download
              </button>
              <button 
                onClick={() => setShowBatch(true)}
                className="flex items-center gap-2 px-6 py-3.5 border border-white/20 rounded-2xl hover:bg-white/5 transition-all"
              >
                Batch Import
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-6 py-3.5 border border-white/20 rounded-2xl hover:bg-white/5 transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
          </div>

          {/* 3D Interactive Download Orb */}
          <div className="flex-shrink-0">
            <DownloadOrb 
              progress={activeDownloads.length > 0 ? activeDownloads[0].progress : 0} 
              status={activeDownloads.length > 0 ? activeDownloads[0].status : 'idle'}
            />
          </div>
        </div>

        {/* URL Input Section */}
        <div id="input-section" className="glass rounded-3xl p-8 mb-10 border border-white/10">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-400 mb-2 px-1">VIDEO URL</div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://www.pornhub.com/view/video123 or any supported site"
                className="w-full bg-zinc-900 border border-white/10 focus:border-blue-500/60 text-lg px-5 py-4 rounded-2xl outline-none placeholder:text-zinc-500"
              />
            </div>

            <div className="w-full md:w-[170px]">
              <div className="text-sm font-medium text-zinc-400 mb-2 px-1">QUALITY</div>
              <select 
                value={quality} 
                onChange={(e) => setQuality(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 px-4 py-[17px] rounded-2xl text-base outline-none"
              >
                {Object.keys({best:1, "2160p":1, "1080p":1, "720p":1, "480p":1, "360p":1, audio:1}).map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-[190px]">
              <div className="text-sm font-medium text-zinc-400 mb-2 px-1">COOKIES</div>
              <select 
                value={cookiesBrowser} 
                onChange={(e) => setCookiesBrowser(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 px-4 py-[17px] rounded-2xl text-base outline-none"
              >
                {['none','chrome','firefox','brave','edge'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button 
                onClick={handleAddDownload}
                disabled={isLoading || !url.trim()}
                className="flex items-center justify-center gap-3 h-[62px] px-10 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-2xl font-semibold text-lg transition-all shadow-xl shadow-blue-950/40"
              >
                {isLoading ? (
                  <RefreshCw className="animate-spin w-5 h-5" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                <span>{isLoading ? 'Starting...' : 'Download'}</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-zinc-500 mt-4 px-1 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" /> Supports PornHub, MissAV, 91Porn, OnlyFans, Twitter/X, Reddit, 1500+ sites
          </div>
        </div>

        {/* Download Queue */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5 px-1">
            <div>
              <div className="font-semibold text-2xl tracking-tight">Active Queue</div>
              <div className="text-sm text-zinc-400">{activeDownloads.length} downloading • {downloads.length} total</div>
            </div>
            <div className="text-sm text-zinc-500">
              {activeDownloads.length > 0 && `${activeDownloads.length} active`}
            </div>
          </div>

          <div className="space-y-3">
            <AnimatePresence>
              {downloads.length === 0 ? (
                <div className="glass border border-white/10 py-16 rounded-3xl flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    <Download className="w-8 h-8 text-zinc-400" />
                  </div>
                  <div className="font-medium">No downloads yet</div>
                  <div className="text-sm text-zinc-500 mt-1">Paste a URL above to begin</div>
                </div>
              ) : (
                downloads
                  .sort((a, b) => {
                    const order = ['downloading', 'pending', 'completed', 'error', 'cancelled'];
                    return order.indexOf(a.status) - order.indexOf(b.status);
                  })
                  .map((item) => (
                    <QueueItem 
                      key={item.id} 
                      item={item} 
                      onCancel={() => cancelDownload(item.id)}
                      onRemove={() => removeDownload(item.id)}
                      onPreview={() => openFormatPreview(item.url)}
                    />
                  ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { label: "Total Downloads", value: downloads.length },
            { label: "Completed", value: completedDownloads.length },
            { label: "Active", value: activeDownloads.length },
            { label: "Sites Supported", value: "1500+" },
          ].map((stat, idx) => (
            <div key={idx} className="glass border border-white/10 p-5 rounded-2xl">
              <div className="text-4xl font-semibold tracking-tighter">{stat.value}</div>
              <div className="text-xs uppercase tracking-[2px] text-zinc-400 mt-1.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <SettingsDialog 
        open={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen} 
        settings={settings} 
        onSave={updateSettings} 
      />

      {showFormatPreview && previewUrl && (
        <FormatPreview 
          url={previewUrl} 
          onClose={() => setShowFormatPreview(false)} 
        />
      )}

      {showBatch && (
        <BatchImport 
          onClose={() => setShowBatch(false)} 
          onStartBatch={handleBatchDownload} 
        />
      )}
    </div>
  );
}
