import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ToggleRight } from 'lucide-react';
import NodeHeader from './NodeHeader';
import usePipelineStore from '../../../store/usePipelineStore';

const RPI5_GPIO_OUTPUT_PINS = [
  { pin: '23', label: 'GPIO 23 (Pin 16)' },
  { pin: '24', label: 'GPIO 24 (Pin 18)' },
  { pin: '25', label: 'GPIO 25 (Pin 22)' },
  { pin: '26', label: 'GPIO 26 (Pin 37)' },
  { pin: '17', label: 'GPIO 17 (Pin 11)' },
  { pin: '27', label: 'GPIO 27 (Pin 13)' },
  { pin: '22', label: 'GPIO 22 (Pin 15)' },
  { pin: '5',  label: 'GPIO 5 (Pin 29)' },
  { pin: '6',  label: 'GPIO 6 (Pin 31)' },
  { pin: '16', label: 'GPIO 16 (Pin 36)' },
];

export default function DigitalOutputNode({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;

  const currentPin = String(data?.pin ?? '23');
  const activeState = data?.activeState ?? 'high';
  const action = data?.action ?? 'on';
  const triggerOn = data?.triggerOn !== false;

  const updateField = (field, value) => {
    if (data?.onChange) {
      data.onChange({ ...data, [field]: value });
    } else {
      updateNodeData(id, { [field]: value });
    }
  };

  return (
    <div className={`bg-surface border-2 border-orange-500 rounded-xl shadow-xl shadow-orange-900/20 overflow-hidden ${isCompact ? 'w-48' : 'w-72'}`}>
      <NodeHeader
        id={id}
        icon={ToggleRight}
        iconBg="bg-orange-600"
        headerBg="bg-orange-500/20 border-orange-800/50"
        defaultName="Digital Output"
        defaultSubtitle="Raspberry Pi 5 (Relay / GPIO 3.3V)"
        data={data}
      />

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-orange-500 border-2 border-line-subtle" />

      <div className={`p-4 space-y-3 ${isCompact ? 'hidden' : ''}`}>
        {/* Target Pin */}
        <div>
          <label className="text-xs text-fg-muted block mb-1">Target BCM Pin</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
            value={currentPin}
            onChange={(e) => updateField('pin', e.target.value)}
          >
            {RPI5_GPIO_OUTPUT_PINS.map((p) => (
              <option key={p.pin} value={p.pin}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Output Logic Mode */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-fg-muted block mb-1">Trigger Logic</label>
            <select
              className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
              value={activeState}
              onChange={(e) => updateField('activeState', e.target.value)}
            >
              <option value="high">Active HIGH (3.3V)</option>
              <option value="low">Active LOW (Relay GND)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-fg-muted block mb-1">Action</label>
            <select 
              className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
              value={action}
              onChange={(e) => updateField('action', e.target.value)}
            >
              <option value="on">Turn ON</option>
              <option value="off">Turn OFF</option>
            </select>
          </div>
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
          Triggers when <code className="text-orange-700 dark:text-orange-400 bg-canvas px-1 py-0.5 rounded">payload == {triggerOn ? "True" : "False"}</code>
        </div>
      </div>
    </div>
  );
}
