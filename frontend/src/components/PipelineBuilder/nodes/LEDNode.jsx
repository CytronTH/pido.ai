import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Lightbulb } from 'lucide-react';
import NodeHeader from './NodeHeader';
import usePipelineStore from '../../../store/usePipelineStore';

export default function LEDNode({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;

  const handlePinChange = (e) => {
    updateNodeData(id, { pin: e.target.value });
  };

  const handleBrightnessChange = (e) => {
    updateNodeData(id, { brightness: Number(e.target.value) });
  };

  return (
    <div className={`bg-surface border-2 border-yellow-500 rounded-xl shadow-xl shadow-yellow-900/20 overflow-hidden ${isCompact ? 'w-48' : 'w-64'}`}>
      <NodeHeader
        id={id}
        icon={Lightbulb}
        iconBg="bg-yellow-600"
        headerBg="bg-yellow-500/20 border-yellow-800/50"
        defaultName="LED Driver"
        defaultSubtitle="PWM Output (Max 2A)"
        data={data}
      />
      
      <div className={`p-4 space-y-3 ${isCompact ? 'hidden' : ''}`}>
        <div>
          <label className="text-xs text-fg-muted block mb-1">Target Pin</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-sm text-fg outline-none nodrag"
            value={data.pin || 'L0'}
            onChange={handlePinChange}
          >
            <option value="L0">L0 (GPIO12)</option>
            <option value="L1">L1 (GPIO13)</option>
            <option value="LED0">User LED 0 (GPIO20)</option>
            <option value="LED1">User LED 1 (GPIO21)</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-fg-muted block mb-1">Brightness (%)</label>
          <input 
            type="number"
            min="0"
            max="100"
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-sm text-fg outline-none nodrag"
            value={data.brightness ?? 100}
            onChange={handleBrightnessChange}
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
        Triggers when <code className="text-yellow-700 dark:text-yellow-400 bg-canvas px-1 py-0.5 rounded">payload == {data?.triggerOn !== false ? "True" : "False"}</code>
      </div>
    </div>
  );
}
