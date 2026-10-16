import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ToggleLeft, AlertTriangle } from 'lucide-react';
import NodeHeader from './NodeHeader';
import usePipelineStore from '../../../store/usePipelineStore';

const RPI5_GPIO_INPUT_PINS = [
  { pin: '17', label: 'GPIO 17 (Pin 11)' },
  { pin: '27', label: 'GPIO 27 (Pin 13)' },
  { pin: '22', label: 'GPIO 22 (Pin 15)' },
  { pin: '23', label: 'GPIO 23 (Pin 16)' },
  { pin: '24', label: 'GPIO 24 (Pin 18)' },
  { pin: '25', label: 'GPIO 25 (Pin 22)' },
  { pin: '4',  label: 'GPIO 4 (Pin 7)' },
  { pin: '5',  label: 'GPIO 5 (Pin 29)' },
  { pin: '6',  label: 'GPIO 6 (Pin 31)' },
  { pin: '16', label: 'GPIO 16 (Pin 36)' },
  { pin: '26', label: 'GPIO 26 (Pin 37)' },
];

export default function DigitalInputNode({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;

  const currentPin = String(data?.pin ?? '17');
  const pullResistor = data?.pullResistor ?? 'up';
  const activeState = data?.activeState ?? 'low';

  const updateField = (field, value) => {
    if (data?.onChange) {
      data.onChange({ ...data, [field]: value });
    } else {
      updateNodeData(id, { [field]: value });
    }
  };

  return (
    <div className={`bg-surface border-2 border-cyan-500 rounded-xl shadow-xl shadow-cyan-900/20 overflow-hidden ${isCompact ? 'w-48' : 'w-72'}`}>
      <NodeHeader
        id={id}
        icon={ToggleLeft}
        iconBg="bg-cyan-600"
        headerBg="bg-cyan-500/20 border-cyan-800/50"
        defaultName="Digital Input"
        defaultSubtitle="Raspberry Pi 5 (3.3V Logic)"
        data={data}
      />

      <div className={`p-4 space-y-3 ${isCompact ? 'hidden' : ''}`}>
        {/* Voltage Warning */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] text-amber-500 font-medium">
          <AlertTriangle size={12} className="shrink-0" />
          <span>Max 3.3V — Do not connect 5V or 24V!</span>
        </div>

        {/* Target Pin */}
        <div>
          <label className="text-xs text-fg-muted block mb-1">Target BCM Pin</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
            value={currentPin}
            onChange={(e) => updateField('pin', e.target.value)}
          >
            {RPI5_GPIO_INPUT_PINS.map((p) => (
              <option key={p.pin} value={p.pin}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Internal Resistor */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-fg-muted block mb-1">Resistor</label>
            <select
              className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
              value={pullResistor}
              onChange={(e) => updateField('pullResistor', e.target.value)}
            >
              <option value="up">Pull-Up (GND switch)</option>
              <option value="down">Pull-Down (3.3V)</option>
              <option value="none">Floating (None)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-fg-muted block mb-1">Active When</label>
            <select
              className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
              value={activeState}
              onChange={(e) => updateField('activeState', e.target.value)}
            >
              <option value="low">LOW / GND (Closed)</option>
              <option value="high">HIGH / 3.3V (Open)</option>
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-line text-[10px] text-fg-subtle">
          Outputs <code className="text-cyan-600 dark:text-cyan-400 bg-canvas px-1 py-0.5 rounded">payload: True</code> when input triggered
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-cyan-500 border-2 border-line-subtle" />
    </div>
  );
}
