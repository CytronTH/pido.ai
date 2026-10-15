import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BellRing } from 'lucide-react';
import NodeHeader from './NodeHeader';
import usePipelineStore from '../../../store/usePipelineStore';

const RPI5_BUZZER_PINS = [
  { pin: '19', label: 'GPIO 19 (Pin 35 - Recommended)' },
  { pin: '18', label: 'GPIO 18 (Pin 12)' },
  { pin: '21', label: 'GPIO 21 (Pin 40)' },
  { pin: '26', label: 'GPIO 26 (Pin 37)' },
  { pin: '13', label: 'GPIO 13 (Pin 33)' },
];

export default function BuzzerNode({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;

  const currentPin = String(data?.pin ?? '19');
  const duration = data?.duration ?? 1.0;
  const triggerOn = data?.triggerOn !== false;

  const updateField = (field, value) => {
    if (data?.onChange) {
      data.onChange({ ...data, [field]: value });
    } else {
      updateNodeData(id, { [field]: value });
    }
  };

  return (
    <div className={`bg-surface border-2 border-red-500 rounded-xl shadow-xl shadow-red-900/20 overflow-hidden ${isCompact ? 'w-48' : 'w-72'}`}>
      <NodeHeader
        id={id}
        icon={BellRing}
        iconBg="bg-red-600"
        headerBg="bg-red-500/20 border-red-800/50"
        defaultName="Active Buzzer"
        defaultSubtitle="Raspberry Pi 5 (External Buzzer)"
        data={data}
      />

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-red-500 border-2 border-line-subtle" />

      <div className={`p-4 space-y-3 ${isCompact ? 'hidden' : ''}`}>
        {/* Target Pin */}
        <div>
          <label className="text-xs text-fg-muted block mb-1">Target BCM Pin</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
            value={currentPin}
            onChange={(e) => updateField('pin', e.target.value)}
          >
            {RPI5_BUZZER_PINS.map((p) => (
              <option key={p.pin} value={p.pin}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-fg-muted block mb-1">Beep Duration (seconds)</label>
          <input 
            type="number"
            step="0.1"
            min="0.1"
            max="60"
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag font-mono"
            value={duration}
            onChange={(e) => updateField('duration', Number(e.target.value))}
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
          Beeps for {duration}s when <code className="text-red-600 dark:text-red-400 bg-canvas px-1 py-0.5 rounded">payload == {triggerOn ? "True" : "False"}</code>
        </div>
      </div>
    </div>
  );
}
