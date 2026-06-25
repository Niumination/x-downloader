"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, FolderOpen } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: {
    output_dir: string;
    concurrent_downloads?: number;
    embed_metadata: boolean;
    embed_thumbnail: boolean;
  };
  onSave: (settings: any) => void;
}

export default function SettingsDialog({ open, onOpenChange, settings, onSave }: SettingsDialogProps) {
  const [local, setLocal] = useState(settings);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  if (!open) return null;

  const handleSave = () => {
    onSave(local);
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <div className="font-semibold text-lg">Settings</div>
                <div className="text-sm text-zinc-400">Configure download preferences</div>
              </div>
              <button 
                onClick={() => onOpenChange(false)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <div>
                <label className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" /> Output Directory
                </label>
                <input 
                  type="text"
                  value={local.output_dir}
                  onChange={e => setLocal({...local, output_dir: e.target.value})}
                  className="w-full bg-zinc-800 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500/60"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Embed Metadata</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Add video metadata to file</div>
                </div>
                <button
                  onClick={() => setLocal({...local, embed_metadata: !local.embed_metadata})}
                  className={`w-12 h-7 rounded-full transition-all ${
                    local.embed_metadata ? 'bg-blue-600' : 'bg-zinc-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-all mt-[4px] ${
                    local.embed_metadata ? 'ml-[26px]' : 'ml-[3px]'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Embed Thumbnail</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Save thumbnail as cover art</div>
                </div>
                <button
                  onClick={() => setLocal({...local, embed_thumbnail: !local.embed_thumbnail})}
                  className={`w-12 h-7 rounded-full transition-all ${
                    local.embed_thumbnail ? 'bg-blue-600' : 'bg-zinc-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-all mt-[4px] ${
                    local.embed_thumbnail ? 'ml-[26px]' : 'ml-[3px]'
                  }`} />
                </button>
              </div>

              {/* Browser Cookies */}
              <div>
                <label className="text-sm font-medium text-zinc-300 mb-2">Browser Cookies</label>
                <select className="w-full bg-zinc-800 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none">
                  <option value="none">None</option>
                  <option value="chrome">Chrome</option>
                  <option value="firefox">Firefox</option>
                  <option value="brave">Brave</option>
                  <option value="edge">Edge</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-white/10">
              <button 
                onClick={() => onOpenChange(false)}
                className="flex-1 py-3 px-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 font-medium"
              >
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
