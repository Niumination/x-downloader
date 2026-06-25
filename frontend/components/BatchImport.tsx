"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Download } from 'lucide-react';

interface BatchImportProps {
  onClose: () => void;
  onStartBatch: (urls: string[], quality: string, cookiesBrowser: string) => void;
}

export default function BatchImport({ onClose, onStartBatch }: BatchImportProps) {
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-lg mx-4 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <div className="font-semibold text-lg">Batch Import</div>
              <div className="text-sm text-zinc-400">Import multiple URLs at once</div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4" /> URLs (one per line)
              </label>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="https://www.pornhub.com/view_video.php?viewkey=..."
                rows={8}
                className="w-full bg-zinc-800 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500/60 resize-none"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-zinc-300 mb-2">Quality</label>
                <select 
                  value={quality} 
                  onChange={e => setQuality(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
                >
                  {['best', '1080p', '720p', '480p', 'audio'].map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-zinc-300 mb-2">Cookies</label>
                <select 
                  value={cookiesBrowser} 
                  onChange={e => setCookiesBrowser(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
                >
                  {['none', 'chrome', 'firefox', 'brave', 'edge'].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-sm text-zinc-500 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-xs">
                {urls.length}
              </div>
              valid URLs detected
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-white/10">
            <button 
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleStart}
              disabled={urls.length === 0}
              className="flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-medium"
            >
              <Download className="w-4 h-4" /> Download {urls.length > 0 && `(${urls.length})`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
