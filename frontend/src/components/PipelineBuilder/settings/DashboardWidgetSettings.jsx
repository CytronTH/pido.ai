import React from 'react';
import PayloadPathSelector from './PayloadPathSelector';

export default function DashboardWidgetSettings({ nodeId, data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-muted">Topic / Payload Path</label>
        <div className="relative">
          <input 
            type="text" 
            value={data?.sourcePath || ''} 
            onChange={(e) => onChange({ sourcePath: e.target.value })}
            className="bg-canvas border border-line-strong focus:border-blue-500 text-sm font-mono text-blue-400 rounded px-2.5 py-1.5 w-full outline-none transition-colors"
            placeholder="e.g. payload.counts.Eco"
          />
        </div>
      </div>

      <PayloadPathSelector 
        nodeId={nodeId} 
        selectedPath={data?.sourcePath} 
        onSelect={(path) => onChange({ sourcePath: path })} 
      />
    </div>
  );
}
