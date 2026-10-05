import usePipelineStore from "../../../store/usePipelineStore";
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ToggleRight } from 'lucide-react';
import NodeHeader from './NodeHeader';

export default function DigitalOutputNode({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;
  return (
    <div className={`bg-surface border-2 border-orange-500 rounded-xl shadow-xl shadow-orange-900/20 overflow-hidden ${isCompact ? 'w-48' : 'w-64'}`}>
      <NodeHeader
        id={id}
        icon={ToggleRight}
        iconBg="bg-orange-600"
        headerBg="bg-orange-500/20 border-orange-800/50"
        defaultName="Digital Output"
        defaultSubtitle="Isolated DO (Max 50V)"
        data={data}
      />
      
      <div className={`p-4 space-y-3 ${isCompact ? 'hidden' : ''}`}>
        <div>
          <label className="text-xs text-fg-muted block mb-1">Target Pin</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-sm text-fg outline-none"
            value={data.pin || 'DO0'}
            onChange={(e) => data.onChange?.({ ...data, pin: e.target.value })}
          >
            <option value="DO0">DO0 (GPIO23)</option>
            <option value="DO1">DO1 (GPIO24)</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-fg-muted block mb-1">Action when triggered</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-sm text-fg outline-none"
            value={data.action || 'on'}
            onChange={(e) => data.onChange?.({ ...data, action: e.target.value })}
          >
            <option value="on">Turn ON</option>
            <option value="off">Turn OFF</option>
          </select>
        
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
        Triggers when <code className="text-orange-700 dark:text-orange-400 bg-canvas px-1 py-0.5 rounded">payload == {data?.triggerOn !== false ? "True" : "False"}</code>
      </div>
    </div>
  );
}
