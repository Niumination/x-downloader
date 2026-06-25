"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Download, XCircle, Trash2, Eye, Music, FileVideo,
  CheckCircle, Clock, AlertTriangle
} from 'lucide-react';

interface QueueItemProps {
  item: {
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
  };
  onCancel: () => void;
  onRemove: () => void;
  onPreview: () => void;
}

export default function QueueItem({ item, onCancel, onRemove, onPreview }: QueueItemProps) {
  const { title, url, status, progress, speed, eta, site, quality, error, filename } = item;

  const indicatorColor = 
    status === 'downloading' ? 'bg-blue-500' : 
    status === 'completed' ? 'bg-green-500' : 
    status === 'error' ? 'bg-red-500' : 
    status === 'cancelled' ? 'bg-yellow-500' : 
    'bg-zinc-500';

  const StatusIcon = 
    status === 'completed' ? CheckCircle : 
    status === 'downloading' || status === 'pending' ? Clock : 
    AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="download-row glass border border-white/10 rounded-2xl p-5"
    >
      {/* Main Content */}
      <div className="flex items-start gap-5">
        {/* Status Indicator */}
        <div className="flex flex-col items-center gap-2 min-w-[60px]">
          <div className={`w-3 h-3 rounded-full ${indicatorColor} shadow-lg`} />
          <StatusIcon className={`w-5 h-5 ${status === 'completed' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-zinc-500'}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate text-base">
            {title || url?.substring(0, 60)}
          </div>
          {title && title !== url?.substring(0,60) && (
            <div className="text-sm text-zinc-500 truncate mt-0.5">{url}</div>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
            <span className="uppercase tracking-widest">{site || 'Unknown'}</span>
            <span>{quality}</span>
            {speed && <span>{speed}</span>}
            {eta && <span>ETA: {eta}</span>}
          </div>

          {/* Progress Bar */}
          {(status === 'downloading' || status === 'pending') && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                <span>{progress.toFixed(1)}%</span>
                <span>{speed}</span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                <div 
                  className="progress-bar h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                  style={{ width: `${Math.max(0, progress)}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="mt-2 text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Completed */}
          {status === 'completed' && filename && (
            <div className="mt-2 text-sm text-green-400 flex items-center gap-2">
              <FileVideo className="w-4 h-4" />
              {filename}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {status === 'downloading' && (
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl text-red-300 hover:bg-red-500/10 transition-all active:scale-95"
            >
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          )}
          {['completed', 'error', 'cancelled'].includes(status) && (
            <button
              onClick={onRemove}
              className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl text-zinc-400 hover:bg-white/5 transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Remove
            </button>
          )}
          {status === 'pending' && (
            <button
              onClick={onPreview}
              className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl text-zinc-400 hover:bg-white/5 transition-all active:scale-95"
            >
              <Eye className="w-4 h-4" /> Formats
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
