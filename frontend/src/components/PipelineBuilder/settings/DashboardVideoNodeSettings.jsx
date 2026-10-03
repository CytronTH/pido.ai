import React from 'react';

export default function DashboardVideoNodeSettings({ nodeId, data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-muted">Data Path (Stream ID)</label>
        <div className="relative">
          <input 
            type="text" 
            value={data?.dataPath || ''} 
            onChange={(e) => onChange({ dataPath: e.target.value })}
            className="bg-canvas border border-line-strong focus:border-pink-500 text-sm font-mono text-pink-400 rounded px-2.5 py-1.5 w-full outline-none transition-colors"
            placeholder="e.g. cam_1_video"
          />
        </div>
        <p className="text-xs mt-1 text-fg-subtle">Identifier for this video stream. Used when binding data in the Dashboard.</p>
      </div>
    </div>
  );
}
