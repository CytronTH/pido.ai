import React from 'react';
import { Image, Lock } from 'lucide-react';

export default function SnapshotsWidget() {
  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl relative group">
      <div className="bg-surface-2/80 px-3 py-2 flex items-center gap-2 border-b border-line-strong shrink-0">
        <Image size={16} className="text-pink-400" />
        <span className="text-sm font-semibold text-fg">Recent Snapshots</span>
      </div>
      
      {/* Blurred background mock */}
      <div className="flex-1 p-3 grid grid-cols-2 gap-2 opacity-20 blur-sm pointer-events-none">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-surface-2 rounded-lg h-16 border border-line-strong flex items-center justify-center">
            <Image size={24} className="text-fg-faint" />
          </div>
        ))}
      </div>

      {/* Unavailable Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/60 backdrop-blur-[2px] z-10">
        <div className="bg-surface-2/90 p-4 rounded-xl border border-line-strong flex flex-col items-center text-center max-w-[80%]">
          <Lock size={24} className="text-fg-muted mb-2" />
          <h4 className="text-fg font-bold text-sm mb-1">Storage Required</h4>
          <p className="text-xs text-fg-muted">Snapshot saving requires persistent storage. Currently unavailable.</p>
        </div>
      </div>
    </div>
  );
}
