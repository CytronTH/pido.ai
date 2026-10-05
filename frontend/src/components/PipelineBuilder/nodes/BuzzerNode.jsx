import usePipelineStore from "../../../store/usePipelineStore";
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BellRing } from 'lucide-react';
import NodeHeader from './NodeHeader';

export default function BuzzerNode({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;
  return (
    <div className={`bg-surface border-2 border-red-500 rounded-xl shadow-xl shadow-red-900/20 overflow-hidden ${isCompact ? 'w-48' : 'w-64'}`}>
      <NodeHeader
        id={id}
        icon={BellRing}
        iconBg="bg-red-600"
        headerBg="bg-red-500/20 border-red-800/50"
        defaultName="Active Buzzer"
        defaultSubtitle="GPIO19 Onboard"
        data={data}
      />
      
      <div className={`p-4 space-y-3 ${isCompact ? 'hidden' : ''}`}>
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
