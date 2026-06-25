"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader } from 'lucide-react';

interface FormatPreviewProps {
  url: string;
  onClose: () => void;
}

export default function FormatPreview({ url, onClose }: FormatPreviewProps) {
  const [formats, setFormats] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFormats = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/preview-formats?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.success) {
          setFormats(data.formats);
        } else {
          setError(data.error || 'Failed to fetch formats');
        }
      } catch (e) {
        setError('Backend not reachable');
      } finally {
        setLoading(false);
      }
    };
    fetchFormats();
  }, [url]);

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
          className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-2xl mx-4 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <div className="font-semibold text-lg">Format Preview</div>
              <div className="text-sm text-zinc-400 truncate max-w-md">{url}</div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center py-16 gap-4">
                <Loader className="animate-spin w-8 h-8 text-zinc-400" />
                <div className="text-zinc-400">Fetching available formats...</div>
              </div>
            ) : error ? (
              <div className="text-red-400 py-8 text-center">{error}</div>
            ) : (
              <pre className="text-sm text-zinc-300 font-mono whitespace-pre leading-relaxed">
                {formats}
              </pre>
            )}
          </div>

          <div className="flex justify-end p-6 border-t border-white/10">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-2xl border border-white/10 hover:bg-white/5 transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
