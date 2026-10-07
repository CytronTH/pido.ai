import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ToggleLeft } from 'lucide-react';
import NodeHeader from './NodeHeader';

export default function DigitalInputNode({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  return (
    <div className={`bg-surface border-2 border-cyan-500 rounded-xl shadow-xl shadow-cyan-900/20 overflow-hidden ${isCompact ? 'w-48' : 'w-64'}`}>
      <NodeHeader
        id={id}
        icon={ToggleLeft}
        iconBg="bg-cyan-600"
        headerBg="bg-cyan-500/20 border-cyan-800/50"
        defaultName="Digital Input"
        defaultSubtitle="Isolated DI (Max 50V)"
        data={data}
      />
      
      <div className={`p-4 space-y-2 ${isCompact ? 'hidden' : ''}`}>
        <div>
          <label className="text-xs text-fg-muted block mb-1">Target Pin</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-sm text-fg outline-none"
            value={data.pin || 'DI0'}
            onChange={(e) => data.onChange?.({ ...data, pin: e.target.value })}
          >
            <option value="DI0">DI0 (GPIO22)</option>
            <option value="DI1">DI1 (GPIO27)</option>
            <option value="USER_BTN">User Button (GPIO4)</option>
          </select>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-cyan-500 border-2 border-line-subtle" />
    </div>
  );
}
