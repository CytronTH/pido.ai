import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Settings2 } from 'lucide-react';
import NodeHeader from './NodeHeader';

export default function RS485Node({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  return (
    <div className={`bg-surface border-2 border-indigo-500 rounded-xl shadow-xl shadow-indigo-900/20 overflow-hidden ${isCompact ? 'w-48' : 'w-64'}`}>
      <NodeHeader
        id={id}
        icon={Settings2}
        iconBg="bg-indigo-600"
        headerBg="bg-indigo-500/20 border-indigo-800/50"
        defaultName="RS485 Modbus"
        defaultSubtitle="/dev/ttyACM0"
        data={data}
      />
      
      <div className={`p-4 space-y-3 ${isCompact ? 'hidden' : ''}`}>
        <div>
          <label className="text-xs text-fg-muted block mb-1">Payload Format</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-sm text-fg outline-none"
            value={data.hex_mode ? 'hex' : 'text'}
            onChange={(e) => data.onChange?.({ ...data, hex_mode: e.target.value === 'hex' })}
          >
            <option value="text">Plain Text (ASCII)</option>
            <option value="hex">HEX Code</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-fg-muted block mb-1">Data to send</label>
          <input 
            type="text"
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-sm text-fg outline-none font-mono"
            placeholder={data.hex_mode ? "01 05 00 01 FF 00 DD FA" : "Trigger=1"}
            value={data.payload || ''}
            onChange={(e) => data.onChange?.({ ...data, payload: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-line text-[10px] text-fg-subtle">
        Triggers when <code className="text-indigo-600 dark:text-indigo-400 bg-canvas px-1 py-0.5 rounded">msg.payload == True</code>
      </div>
    </div>
  );
}
