import usePipelineStore from "../../../store/usePipelineStore";
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BellRing } from 'lucide-react';
import NodeMenu from './NodeMenu';

export default function BuzzerNode({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;
  return (
    <div className={`bg-surface border-2 border-red-500 rounded-xl p-4 shadow-xl shadow-red-900/20 ${isCompact ? 'w-48' : 'w-64'}`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-red-500 border-2 border-line-subtle" />
      
      <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/20 p-2 rounded-lg">
            <BellRing className="text-red-600 dark:text-red-400" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-fg text-sm">Active Buzzer</h3>
            <p className="text-xs text-red-500 font-mono">GPIO19 Onboard</p>
          </div>
        </div>
        {!isCompact && <NodeMenu id={id} />}
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-xs text-fg-muted block mb-1">Duration (seconds)</label>
          <input 
            type="number"
            step="0.1"
            min="0.1"
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-sm text-fg outline-none"
            value={data.duration ?? 1.0}
            onChange={(e) => data.onChange?.({ ...data, duration: Number(e.target.value) })}
          />
        
        <div>
          <label className="text-xs text-fg-muted block mb-1">Trigger On (Payload)</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-sm text-fg outline-none nodrag"
            value={data.triggerOn !== undefined ? String(data.triggerOn) : "true"}
            onChange={(e) => data.onChange ? data.onChange({ ...data, triggerOn: e.target.value === 'true' }) : updateNodeData(id, { triggerOn: e.target.value === 'true' })}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
</div>
      </div>
      <div className="mt-3 pt-2 border-t border-line text-[10px] text-fg-subtle">
        Triggers when <code className="text-red-600 dark:text-red-400 bg-canvas px-1 py-0.5 rounded">payload == {data?.triggerOn !== false ? "True" : "False"}</code>
      </div>
    </div>
  );
}
