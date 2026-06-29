import React from 'react';
import { X, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  outputDir: string;
  setOutputDir: (dir: string) => void;
}

export default function SettingsModal({ isOpen, onClose, outputDir, setOutputDir }: SettingsModalProps) {
  if (!isOpen) return null;

  const selectFolder = async () => {
    const selected = await open({ directory: true, multiple: false, title: "Pilih Folder Output Default" });
    if (selected) setOutputDir(selected as string);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0 }}>Settings</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '8px' }}>DEFAULT OUTPUT FOLDER</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#27272a', padding: '12px 16px', borderRadius: '10px' }}>
            <div style={{ flex: 1, fontSize: '14px', wordBreak: 'break-all' }}>{outputDir || 'Default (Downloads folder)'}</div>
            <button onClick={selectFolder} style={{ padding: '8px 14px', background: '#3f3f46', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderOpen size={16} /> Browse
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#27272a', border: 'none', borderRadius: '10px' }}>Close</button>
          <button onClick={onClose} style={{ padding: '10px 24px', background: '#3b82f6', border: 'none', borderRadius: '10px', color: 'white' }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}