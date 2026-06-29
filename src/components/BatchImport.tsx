import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Download } from 'lucide-react';

interface BatchImportProps {
  isOpen: boolean;
  onClose: () => void;
  onStartBatch: (urls: string[], quality: string, cookiesBrowser: string) => void;
}

export default function BatchImport({ isOpen, onClose, onStartBatch }: BatchImportProps) {
  const [input, setInput] = useState('');
  const [quality, setQuality] = useState('best');
  const [cookiesBrowser, setCookiesBrowser] = useState('none');

  const urls = input
    .split('\n')
    .map(u => u.trim())
    .filter(u => u.length > 0 && u.startsWith('http'));

  const handleStart = () => {
    if (urls.length === 0) return;
    onStartBatch(urls, quality, cookiesBrowser);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            style={{
              background: '#18181b', border: '1px solid #27272a',
              borderRadius: '24px', width: '100%', maxWidth: '560px',
              margin: '0 16px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '24px', borderBottom: '1px solid #27272a'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '18px' }}>Batch Import</div>
                <div style={{ fontSize: '13px', color: '#a1a1aa', marginTop: '2px' }}>
                  Import multiple URLs at once
                </div>
              </div>
              <button onClick={onClose} style={{
                width: '40px', height: '40px', borderRadius: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'none', color: '#a1a1aa', cursor: 'pointer',
              }}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  fontSize: '13px', fontWeight: 500, color: '#d4d4d8',
                  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'
                }}>
                  <Upload size={16} /> URLs (one per line)
                </label>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="https://www.pornhub.com/view_video.php?viewkey=..."
                  rows={8}
                  style={{
                    width: '100%', background: '#27272a', border: '1px solid #3f3f46',
                    borderRadius: '16px', padding: '12px 16px', fontSize: '14px',
                    color: 'white', outline: 'none', resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px', display: 'block' }}>Quality</label>
                  <select value={quality} onChange={e => setQuality(e.target.value)} style={{
                    width: '100%', background: '#27272a', border: '1px solid #3f3f46',
                    borderRadius: '16px', padding: '12px 16px', fontSize: '14px', color: 'white',
                  }}>
                    {['best', '1080p', '720p', '480p', 'audio'].map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px', display: 'block' }}>Cookies</label>
                  <select value={cookiesBrowser} onChange={e => setCookiesBrowser(e.target.value)} style={{
                    width: '100%', background: '#27272a', border: '1px solid #3f3f46',
                    borderRadius: '16px', padding: '12px 16px', fontSize: '14px', color: 'white',
                  }}>
                    {['none', 'chrome', 'firefox', 'brave', 'edge'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', background: '#27272a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                }}>
                  {urls.length}
                </div>
                valid URLs detected
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: '12px', padding: '24px',
              borderTop: '1px solid #27272a'
            }}>
              <button onClick={onClose} style={{
                flex: 1, padding: '12px', borderRadius: '16px',
                border: '1px solid #3f3f46', background: 'none', color: 'white',
                cursor: 'pointer', fontSize: '14px',
              }}>
                Cancel
              </button>
              <button onClick={handleStart} disabled={urls.length === 0} style={{
                flex: 1, padding: '12px', borderRadius: '16px',
                border: 'none', background: urls.length === 0 ? '#27272a' : '#3b82f6',
                color: 'white', cursor: urls.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                <Download size={16} /> Download {urls.length > 0 && `(${urls.length})`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
