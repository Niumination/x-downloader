import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { Download, Settings, FolderOpen, Trash2, List } from 'lucide-react';
import { motion } from 'framer-motion';
import DownloadOrb from './components/DownloadOrb';
import SettingsModal from './components/SettingsModal';
import BatchImport from './components/BatchImport';
import FormatPreview from './components/FormatPreview';

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
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // --- Real-time progress from Rust backend ---
  useEffect(() => {
    const unlisten = listen<DownloadItem>('download-update', (event) => {
      setDownloads(prev =>
        prev.map(item =>
          item.id === event.payload.id
            ? { ...item, ...event.payload }
            : item
        )
      );
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // --- Single download ---
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
    const currentUrl = url.trim();
    setUrl('');

    try {
      await invoke('start_download', {
        url: currentUrl,
        quality,
        cookiesBrowser,
        outputDir: outputDir || null,
      });
    } catch (error) {
      setDownloads(prev => prev.map(item =>
        item.id === newItem.id
          ? { ...item, status: 'error', error: String(error) }
          : item
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // --- Batch import ---
  const handleStartBatch = (urls: string[], batchQuality: string, batchCookies: string) => {
    const timestamp = Date.now();
    const newItems: DownloadItem[] = urls.map((u, i) => ({
      id: timestamp + i,
      url: u,
      title: 'Queued...',
      site: 'Batch',
      quality: batchQuality,
      status: 'pending',
      progress: 0,
      speed: '',
      eta: '',
      filename: '',
      error: '',
    }));

    setDownloads(prev => [...newItems, ...prev]);

    // Start each download sequentially
    urls.forEach((u, i) => {
      const itemId = timestamp + i;
      invoke('start_download', {
        url: u,
        quality: batchQuality,
        cookiesBrowser: batchCookies,
        outputDir: outputDir || null,
      }).catch((error) => {
        setDownloads(prev => prev.map(item =>
          item.id === itemId
            ? { ...item, status: 'error', error: String(error) }
            : item
        ));
      });
    });
  };

  // --- Cancel / Remove ---
  const cancelDownload = async (id: number) => {
    try {
      await invoke('cancel_download', { id });
    } catch (error) {
      console.error(error);
    }
  };

  const removeDownload = (id: number) => {
    setDownloads(prev => prev.filter(item => item.id !== id));
  };

  // --- Folder picker ---
  const selectOutputFolder = async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Pilih Folder Output' });
    if (selected) setOutputDir(selected as string);
  };

  // --- Derived ---
  const activeDownload = downloads.find(d => d.status === 'downloading' || d.status === 'pending');

  return (
    <div style={{ backgroundColor: '#09090b', color: 'white', minHeight: '100vh', padding: '32px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 600 }}>X-Downloader</h1>
              <p style={{ color: '#71717a', fontSize: '13px', margin: 0 }}>v2.0 • Native</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setIsBatchOpen(true)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', background: '#27272a', border: 'none',
              borderRadius: '10px', color: '#a1a1aa', cursor: 'pointer',
            }}>
              <List size={18} /> Batch
            </button>
            <button onClick={() => setIsSettingsOpen(true)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', background: '#27272a', border: 'none',
              borderRadius: '10px', color: '#a1a1aa', cursor: 'pointer',
            }}>
              <Settings size={18} /> Settings
            </button>
          </div>
        </div>

        {/* Input + Orb */}
        <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div style={{ flexShrink: 0 }}>
            <DownloadOrb progress={activeDownload?.progress || 0} status={activeDownload?.status || 'idle'} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ background: '#18181b', padding: '24px', borderRadius: '16px', border: '1px solid #27272a' }}>
              {/* URL input */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDownload()}
                  placeholder="Paste URL dari PornHub, MissAV, xVideos..."
                  style={{
                    flex: 1, padding: '14px 16px', background: '#27272a',
                    border: '1px solid #3f3f46', borderRadius: '10px',
                    color: 'white', fontSize: '15px', outline: 'none',
                  }}
                />
                <button
                  onClick={() => setPreviewUrl(url.trim())}
                  disabled={!url.trim()}
                  title="Preview available formats"
                  style={{
                    padding: '0 16px', background: '#27272a', border: '1px solid #3f3f46',
                    borderRadius: '10px', color: url.trim() ? '#a1a1aa' : '#52525b',
                    cursor: url.trim() ? 'pointer' : 'not-allowed', fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  Formats
                </button>
                <button
                  onClick={handleAddDownload}
                  disabled={isLoading || !url.trim()}
                  style={{
                    padding: '0 28px', background: '#3b82f6', border: 'none',
                    borderRadius: '10px', color: 'white', fontWeight: 600,
                    cursor: isLoading || !url.trim() ? 'not-allowed' : 'pointer',
                    opacity: isLoading || !url.trim() ? 0.6 : 1,
                  }}
                >
                  {isLoading ? 'Starting...' : 'Download'}
                </button>
              </div>

              {/* Options row */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>QUALITY</div>
                  <select value={quality} onChange={e => setQuality(e.target.value)} style={{
                    width: '100%', padding: '12px', background: '#27272a',
                    border: '1px solid #3f3f46', borderRadius: '10px', color: 'white',
                  }}>
                    <option value="best">Best Quality</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="audio">Audio Only</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>COOKIES</div>
                  <select value={cookiesBrowser} onChange={e => setCookiesBrowser(e.target.value)} style={{
                    width: '100%', padding: '12px', background: '#27272a',
                    border: '1px solid #3f3f46', borderRadius: '10px', color: 'white',
                  }}>
                    <option value="none">No Cookies</option>
                    <option value="chrome">Chrome</option>
                    <option value="firefox">Firefox</option>
                  </select>
                </div>
                <button onClick={selectOutputFolder} style={{
                  padding: '12px 18px', background: '#27272a', border: '1px solid #3f3f46',
                  borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px',
                  color: '#a1a1aa', cursor: 'pointer',
                }}>
                  <FolderOpen size={18} /> {outputDir ? 'Change' : 'Folder'}
                </button>
              </div>
              {outputDir && (
                <div style={{ fontSize: '12px', color: '#71717a', marginTop: '8px' }}>
                  Output: {outputDir}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Download Queue */}
        <div>
          <h3 style={{ marginBottom: '16px' }}>Download Queue ({downloads.length})</h3>
          {downloads.length === 0 ? (
            <div style={{
              background: '#18181b', padding: '60px', borderRadius: '16px',
              textAlign: 'center', border: '1px solid #27272a', color: '#71717a',
            }}>
              No downloads yet. Paste a URL above to start.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {downloads.map(item => (
                <div
                  key={item.id}
                  style={{
                    background: '#18181b', padding: '20px', borderRadius: '12px',
                    border: '1px solid #27272a',
                    opacity: item.status === 'completed' ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{
                          background: item.status === 'downloading' ? '#1e3a8a'
                            : item.status === 'completed' ? '#14532d'
                            : item.status === 'error' ? '#7f1d1d'
                            : item.status === 'cancelled' ? '#292524'
                            : '#27272a',
                          color: item.status === 'downloading' ? '#60a5fa'
                            : item.status === 'completed' ? '#4ade80'
                            : item.status === 'error' ? '#f87171'
                            : item.status === 'cancelled' ? '#a8a29e'
                            : '#a1a1aa',
                          padding: '2px 10px', borderRadius: '999px', fontSize: '11px',
                          fontWeight: 500, textTransform: 'uppercase',
                        }}>
                          {item.status}
                        </span>
                        {item.site !== 'Detecting...' && item.site && (
                          <span style={{ color: '#71717a', fontSize: '12px' }}>{item.site}</span>
                        )}
                        {item.quality && item.quality !== 'best' && (
                          <span style={{ color: '#52525b', fontSize: '11px' }}>{item.quality}</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 500, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title || item.url}
                      </div>
                      {item.error && (
                        <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>
                          {item.error}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                      {(item.status === 'downloading' || item.status === 'pending') && (
                        <button onClick={() => cancelDownload(item.id)} style={{
                          padding: '8px 14px', background: '#292524', border: '1px solid #44403c',
                          borderRadius: '8px', color: '#a8a29e', cursor: 'pointer', fontSize: '13px',
                        }}>
                          Cancel
                        </button>
                      )}
                      <button onClick={() => removeDownload(item.id)} style={{
                        padding: '8px', background: '#27272a', border: '1px solid #3f3f46',
                        borderRadius: '8px', color: '#71717a', cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {item.status === 'downloading' && (
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span>{item.progress.toFixed(1)}%</span>
                        <span style={{ color: '#a1a1aa' }}>
                          {item.speed && `${item.speed}`}
                          {item.speed && item.eta && ' • '}
                          {item.eta && `${item.eta}`}
                        </span>
                      </div>
                      <div style={{ height: '6px', background: '#27272a', borderRadius: '999px', overflow: 'hidden' }}>
                        <motion.div
                          style={{ height: '100%', background: 'linear-gradient(90deg, #3b82f6, #2563eb)', borderRadius: '999px' }}
                          animate={{ width: `${item.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        outputDir={outputDir}
        setOutputDir={setOutputDir}
      />
      <BatchImport
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        onStartBatch={handleStartBatch}
      />
      {previewUrl && (
        <FormatPreview
          url={previewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>
  );
}

export default App;
