import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Lightbulb } from 'lucide-react';
import NodeHeader from './NodeHeader';
import usePipelineStore from '../../../store/usePipelineStore';

const RPI5_PWM_PINS = [
  { pin: '12', label: 'GPIO 12 (Hardware PWM0 - Pin 32)' },
  { pin: '13', label: 'GPIO 13 (Hardware PWM1 - Pin 33)' },
  { pin: '18', label: 'GPIO 18 (Hardware PWM0 - Pin 12)' },
  { pin: '19', label: 'GPIO 19 (Hardware PWM1 - Pin 35)' },
  { pin: '20', label: 'GPIO 20 (Pin 38)' },
  { pin: '21', label: 'GPIO 21 (Pin 40)' },
];

export default function LEDNode({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;

  const currentPin = String(data?.pin ?? '12');
  const brightness = data?.brightness ?? 100;
  const triggerOn = data?.triggerOn !== false;

  const updateField = (field, value) => {
    if (data?.onChange) {
      data.onChange({ ...data, [field]: value });
    } else {
      updateNodeData(id, { [field]: value });
    }
  };

  return (
    <div className={`bg-surface border-2 border-yellow-500 rounded-xl shadow-xl shadow-yellow-900/20 overflow-hidden ${isCompact ? 'w-48' : 'w-72'}`}>
      <NodeHeader
        id={id}
        icon={Lightbulb}
        iconBg="bg-yellow-600"
        headerBg="bg-yellow-500/20 border-yellow-800/50"
        defaultName="LED / PWM Driver"
        defaultSubtitle="Raspberry Pi 5 (3.3V Logic PWM)"
        data={data}
      />

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-yellow-500 border-2 border-line-subtle" />

      <div className={`p-4 space-y-3 ${isCompact ? 'hidden' : ''}`}>
        {/* Target Pin */}
        <div>
          <label className="text-xs text-fg-muted block mb-1">Target BCM Pin</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
            value={currentPin}
            onChange={(e) => updateField('pin', e.target.value)}
          >
            {RPI5_PWM_PINS.map((p) => (
              <option key={p.pin} value={p.pin}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Brightness */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-fg-muted">Brightness</label>
            <span className="text-xs font-mono text-yellow-500">{brightness}%</span>
          </div>
          <input 
            type="range"
            min="0"
            max="100"
            className="w-full accent-yellow-500 cursor-pointer nodrag"
            value={brightness}
            onChange={(e) => updateField('brightness', Number(e.target.value))}
          />
        </div>

        <div>
          <label className="text-xs text-fg-muted block mb-1">Trigger On (Payload)</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
            value={String(triggerOn)}
            onChange={(e) => updateField('triggerOn', e.target.value === 'true')}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>

        <div className="pt-2 border-t border-line text-[10px] text-fg-subtle">
          Triggers when <code className="text-yellow-700 dark:text-yellow-400 bg-canvas px-1 py-0.5 rounded">payload == {triggerOn ? "True" : "False"}</code>
        </div>
      </div>
    </div>
  );
}
