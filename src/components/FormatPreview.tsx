import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader } from 'lucide-react';

interface FormatPreviewProps {
  url: string;
  onClose: () => void;
  onSelectFormat?: (formatCode: string) => void;
}

export default function FormatPreview({ url, onClose, onSelectFormat }: FormatPreviewProps) {
  const [formats, setFormats] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFormats = async () => {
      try {
        const result = await invoke<string>('preview_formats', { url });
        setFormats(result);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    fetchFormats();
  }, [url]);

  return (
    <AnimatePresence>
      {true && (
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
              borderRadius: '24px', width: '100%', maxWidth: '700px',
              margin: '0 16px', maxHeight: '80vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '24px', borderBottom: '1px solid #27272a', flexShrink: 0,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '18px' }}>Format Preview</div>
                <div style={{
                  fontSize: '13px', color: '#a1a1aa', marginTop: '2px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px',
                }}>
                  {url}
                </div>
              </div>
              <button onClick={onClose} style={{
                width: '40px', height: '40px', borderRadius: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'none', color: '#a1a1aa', cursor: 'pointer', flexShrink: 0,
              }}>
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{
              padding: '24px', overflowY: 'auto', flex: 1,
            }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '16px' }}>
                  <div style={{ animation: 'spin 1s linear infinite' }}>
                    <Loader size={32} />
                  </div>
                  <div style={{ color: '#a1a1aa', fontSize: '14px' }}>Fetching available formats...</div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
              ) : error ? (
                <div style={{ color: '#f87171', padding: '32px 0', textAlign: 'center' }}>{error}</div>
              ) : (
                <pre style={{
                  fontSize: '13px', color: '#d4d4d8', fontFamily: '"SF Mono", "Fira Code", "Fira Mono", Menlo, monospace',
                  whiteSpace: 'pre', lineHeight: '1.6', overflowX: 'auto',
                }}>
                  {formats}
                </pre>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: '12px',
              padding: '24px', borderTop: '1px solid #27272a', flexShrink: 0,
            }}>
              {onSelectFormat && !loading && !error && (
                <button onClick={() => {
                  // User can manually type a format code to select
                }} style={{
                  padding: '10px 24px', borderRadius: '16px',
                  border: '1px solid #3f3f46', background: 'none', color: '#a1a1aa',
                  cursor: 'pointer', fontSize: '14px',
                }}>
                  Select Format
                </button>
              )}
              <button onClick={onClose} style={{
                padding: '10px 24px', borderRadius: '16px',
                border: '1px solid #3f3f46', background: 'none', color: 'white',
                cursor: 'pointer', fontSize: '14px',
              }}>
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
