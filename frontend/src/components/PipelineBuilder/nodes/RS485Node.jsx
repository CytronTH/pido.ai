import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Settings2 } from 'lucide-react';
import NodeMenu from './NodeMenu';

export default function RS485Node({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  return (
    <div className={`bg-surface border-2 border-indigo-500 rounded-xl p-4 shadow-xl shadow-indigo-900/20 ${isCompact ? 'w-48' : 'w-64'}`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500 border-2 border-line-subtle" />
      
      <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/20 p-2 rounded-lg">
            <Settings2 className="text-indigo-600 dark:text-indigo-400" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-fg text-sm">RS485 Modbus</h3>
            <p className="text-xs text-indigo-500 font-mono">/dev/ttyACM0</p>
          </div>
        </div>
        {!isCompact && <NodeMenu id={id} />}
      </div>
      
      <div className="space-y-3">
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
