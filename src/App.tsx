import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Download, Settings, FolderOpen, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import DownloadOrb from './components/DownloadOrb';
import SettingsModal from './components/SettingsModal';

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

function App() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('best');
  const [cookiesBrowser, setCookiesBrowser] = useState('none');
  const [outputDir, setOutputDir] = useState('');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const selectOutputFolder = async () => {
    const selected = await open({ directory: true, multiple: false, title: "Pilih Folder Output" });
    if (selected) setOutputDir(selected as string);
  };

  const handleAddDownload = async () => {
    if (!url.trim()) return;
    setIsLoading(true);

    const newItem: DownloadItem = {
      id: Date.now(),
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

    setDownloads(prev => [newItem, ...prev]);
    setUrl('');

    try {
      const result = await invoke('start_download', {
        url: url.trim(),
        quality,
        cookiesBrowser,
        outputDir: outputDir || null,
      });

      setDownloads(prev => prev.map(item =>
        item.id === newItem.id ? { ...item, ...result as any, status: 'downloading' } : item
      ));
    } catch (error) {
      setDownloads(prev => prev.map(item =>
        item.id === newItem.id ? { ...item, status: 'error', error: String(error) } : item
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const cancelDownload = async (id: number) => {
    try {
      await invoke('cancel_download', { id });
      setDownloads(prev => prev.map(item => item.id === id ? { ...item, status: 'cancelled' } : item));
    } catch (error) { console.error(error); }
  };

  const removeDownload = (id: number) => {
    setDownloads(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div style={{ backgroundColor: "#09090b", color: "white", minHeight: "100vh", padding: "32px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Download size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "28px", margin: 0, fontWeight: 600 }}>X-Downloader</h1>
              <p style={{ color: "#71717a", fontSize: "13px", margin: 0 }}>v2.0 • Native</p>
            </div>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", background: "#27272a", border: "none", borderRadius: "10px", color: "#a1a1aa", cursor: "pointer" }}>
            <Settings size={18} /> Settings
          </button>
        </div>

        <div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "40px" }}>
          <div style={{ flexShrink: 0 }}>
            <DownloadOrb progress={downloads[0]?.progress || 0} status={downloads[0]?.status || 'idle'} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ background: "#18181b", padding: "24px", borderRadius: "16px", border: "1px solid #27272a" }}>
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddDownload()} placeholder="Paste URL dari PornHub, MissAV, xVideos..." style={{ flex: 1, padding: "14px 16px", background: "#27272a", border: "1px solid #3f3f46", borderRadius: "10px", color: "white", fontSize: "15px" }} />
                <button onClick={handleAddDownload} disabled={isLoading || !url.trim()} style={{ padding: "0 28px", background: "#3b82f6", border: "none", borderRadius: "10px", color: "white", fontWeight: 600, cursor: isLoading || !url.trim() ? "not-allowed" : "pointer" }}>
                  {isLoading ? "Starting..." : "Download"}
                </button>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>QUALITY</div>
                  <select value={quality} onChange={e => setQuality(e.target.value)} style={{ width: "100%", padding: "12px", background: "#27272a", border: "1px solid #3f3f46", borderRadius: "10px", color: "white" }}>
                    <option value="best">Best Quality</option><option value="1080p">1080p</option><option value="720p">720p</option><option value="audio">Audio Only</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>COOKIES</div>
                  <select value={cookiesBrowser} onChange={e => setCookiesBrowser(e.target.value)} style={{ width: "100%", padding: "12px", background: "#27272a", border: "1px solid #3f3f46", borderRadius: "10px", color: "white" }}>
                    <option value="none">No Cookies</option><option value="chrome">Chrome</option><option value="firefox">Firefox</option>
                  </select>
                </div>
                <button onClick={selectOutputFolder} style={{ padding: "12px 18px", background: "#27272a", border: "1px solid #3f3f46", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FolderOpen size={18} /> {outputDir ? "Change" : "Folder"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: "16px" }}>Download Queue ({downloads.length})</h3>
          {downloads.length === 0 ? (
            <div style={{ background: "#18181b", padding: "60px", borderRadius: "16px", textAlign: "center", border: "1px solid #27272a" }}>No downloads yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {downloads.map(item => (
                <div key={item.id} style={{ background: "#18181b", padding: "20px", borderRadius: "12px", border: "1px solid #27272a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <span style={{ background: "#1e3a8a", color: "#60a5fa", padding: "2px 10px", borderRadius: "999px", fontSize: "12px" }}>{item.status}</span>
                        <span style={{ color: "#71717a" }}>{item.site}</span>
                      </div>
                      <div style={{ fontWeight: 500, marginTop: "6px" }}>{item.title || item.url}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {item.status === "downloading" && <button onClick={() => cancelDownload(item.id)}>Cancel</button>}
                      <button onClick={() => removeDownload(item.id)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  {item.status === "downloading" && (
                    <div style={{ marginTop: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                        <span>{item.progress.toFixed(1)}%</span>
                        <span style={{ color: "#a1a1aa" }}>{item.speed} {item.eta}</span>
                      </div>
                      <div style={{ height: "6px", background: "#27272a", borderRadius: "999px", overflow: "hidden" }}>
                        <motion.div style={{ height: "100%", background: "#3b82f6" }} animate={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} outputDir={outputDir} setOutputDir={setOutputDir} />
    </div>
  );
}

export default App;